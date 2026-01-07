import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

// Interfaz para el resultado de la función f_plan_demanda_detalle
interface DetalleRow {
  Accion: string | null;
  Dips: number | null;  // Nota: El campo se llama "Dips" en la tabla
  Stock_Inicio_Semana: number | null;
  Plan_demanda: number | null;
  Venta_Real: number | null;
  updated_at: string | null;
  id: number;
}

// GET: Obtener detalle de una publicación específica usando f_plan_demanda_detalle
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const nodo = searchParams.get('nodo');
    const cuenta = searchParams.get('cuenta');
    const skuSeller = searchParams.get('sku_seller');
    const semana = searchParams.get('semana');
    
    if (!nodo || !cuenta || !skuSeller || !semana) {
      return NextResponse.json(
        { success: false, error: 'Parámetros nodo, cuenta, sku_seller y semana son requeridos' },
        { status: 400 }
      );
    }
    
    const semanaNum = parseInt(semana, 10);
    if (isNaN(semanaNum)) {
      return NextResponse.json(
        { success: false, error: 'Semana debe ser un número válido' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseServer();
    
    // Llamar a la función f_plan_demanda_detalle
    const { data, error } = await supabase.rpc('f_plan_demanda_detalle', {
      p_semana: semanaNum,
      p_nodo: nodo,
      p_cuenta: cuenta,
      p_sku: skuSeller
    });
    
    if (error) {
      console.error('Error llamando f_plan_demanda_detalle:', error);
      return NextResponse.json(
        { success: false, error: `Error en f_plan_demanda_detalle: ${error.message}` },
        { status: 500 }
      );
    }
    
    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        detalle: null,
        message: 'No se encontraron registros para esta publicación y semana'
      });
    }
    
    // El primer registro es el más reciente (ordenado por updated_at DESC)
    const registroActual = data[0] as DetalleRow;
    
    return NextResponse.json({
      success: true,
      detalle: {
        Nodo: nodo,
        Cuenta: cuenta,
        Sku_Seller: skuSeller,
        Semana: semanaNum,
        // Stock y disponibilidad
        Dips: registroActual.Dips,
        Stock_Inicio_Semana: registroActual.Stock_Inicio_Semana,
        // Último escenario aplicado
        Accion: registroActual.Accion,
        Plan_demanda: registroActual.Plan_demanda,
        Venta_Real: registroActual.Venta_Real,
        updated_at: registroActual.updated_at
      }
    });
    
  } catch (error) {
    console.error('Error en GET /api/plan-demanda/detalle:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${error}` },
      { status: 500 }
    );
  }
}

