import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { week, nodo } = await request.json();

    if (!week) {
      return NextResponse.json({ success: false, error: 'Semana no especificada' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Credenciales de Supabase no configuradas' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener registros de la semana y nodo que tienen venta real
    let query = supabase
      .from('Plan_Demanda')
      .select('id, Plan_demanda, Venta_Real')
      .eq('Semana', parseInt(week))
      .not('Venta_Real', 'is', null);
    
    // Filtrar por nodo si se especifica
    if (nodo) {
      query = query.eq('Nodo', nodo);
    }
    
    const { data: records, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message });
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No hay registros con venta real para calcular errores' 
      });
    }

    let processed = 0;
    let totalError = 0;
    let totalAbsError = 0;

    // Calcular errores para cada registro
    for (const record of records) {
      const planDemanda = record.Plan_demanda || 0;
      const ventaReal = record.Venta_Real || 0;

      // Evitar división por cero
      let error = 0;
      let errorAbs = 0;

      if (planDemanda > 0) {
        // Error = (Venta Real - Plan Demanda) / Plan Demanda
        error = (ventaReal - planDemanda) / planDemanda;
        errorAbs = Math.abs(error);
      } else if (ventaReal > 0) {
        // Si no hay plan pero sí venta, es 100% de error
        error = 1;
        errorAbs = 1;
      }

      // Actualizar el registro
      const { error: updateError } = await supabase
        .from('Plan_Demanda')
        .update({
          Error: error,
          Error_Abs: errorAbs,
          updated_at: new Date().toISOString()
        })
        .eq('id', record.id);

      if (!updateError) {
        processed++;
        totalError += error;
        totalAbsError += errorAbs;
      }
    }

    const avgError = processed > 0 ? totalAbsError / processed : 0;

    return NextResponse.json({ 
      success: true, 
      processed,
      avgError,
      message: `Se calcularon errores para ${processed} registros`
    });

  } catch (error) {
    console.error('Error calculating errors:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
}

