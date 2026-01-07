import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

// Interfaz para los datos del reporte
export interface ReportePlanRow {
  Nodo: string;
  Cuenta: string;
  Sku_Seller: string;
  Nombre: string | null;
  Portafolio: string | null;
  SegmentacionDe_Portafolio: string | null;
  
  Semana_VR_1: number;
  Semana_VR_2: number;
  Semana_VR_3: number;
  Semana_VR_4: number;
  Semana_VR_5: number;
  
  Venta_Real_1: number | null;
  Venta_Real_2: number | null;
  Venta_Real_3: number | null;
  Venta_Real_4: number | null;
  Venta_Real_5: number | null;
  
  Semana_PD_0: number;
  Semana_PD_1: number;
  Semana_PD_2: number;
  Semana_PD_3: number;
  Semana_PD_4: number;
  
  Plan_demanda_0: number | null;
  Plan_demanda_1: number | null;
  Plan_demanda_2: number | null;
  Plan_demanda_3: number | null;
  Plan_demanda_4: number | null;
  
  PVP_PD_2: number | null;
  Accion_2: string | null;
  PVP_PD_4: number | null;
  Accion_4: string | null;
}

// Interfaz para escenarios de la tabla
export interface EscenarioRow {
  Nodo: string;
  Cuenta: string;
  Sku_Seller: string;
  Escenario: string;
  Cantidad_Venta: number;
  Precio_Venta: number;
}

// Interfaz para cambios a guardar
export interface CambioGuardar {
  Nodo: string;
  Cuenta: string;
  Sku_Seller: string;
  Semana: number;
  Plan_demanda?: number;
  PVP_PD?: number;
  Accion?: string;
  Escenario_Aplicado: string;
}

// GET: Obtener datos del reporte + escenarios
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semana = searchParams.get('semana');
    const nodo = searchParams.get('nodo');
    const cuenta = searchParams.get('cuenta');
    
    if (!semana) {
      return NextResponse.json(
        { success: false, error: 'Parámetro semana es requerido' },
        { status: 400 }
      );
    }
    
    const semanaNum = parseInt(semana, 10);
    if (isNaN(semanaNum) || semanaNum < 202001 || semanaNum > 209953) {
      return NextResponse.json(
        { success: false, error: 'Semana inválida. Formato esperado: YYYYWW (ej: 202601)' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseServer();
    
    // Llamar a la función fn_reporte_plan
    const { data: reporteData, error: reporteError } = await supabase
      .rpc('fn_reporte_plan', { ref_semana: semanaNum });
    
    if (reporteError) {
      console.error('Error llamando fn_reporte_plan:', reporteError);
      return NextResponse.json(
        { success: false, error: `Error en fn_reporte_plan: ${reporteError.message}` },
        { status: 500 }
      );
    }
    
    let filteredData = reporteData as ReportePlanRow[];
    
    // Aplicar filtros si se proporcionan
    if (nodo && nodo !== 'Todos') {
      filteredData = filteredData.filter(row => row.Nodo === nodo);
    }
    if (cuenta && cuenta !== 'Todos') {
      filteredData = filteredData.filter(row => row.Cuenta === cuenta);
    }
    
    // Obtener TODOS los escenarios de la tabla escenarios_plan_demanda
    const { data: escenariosData, error: escError } = await supabase
      .from('escenarios_plan_demanda')
      .select('Nodo, Cuenta, Sku_Seller, Escenario, Cantidad_Venta, Precio_Venta');
    
    if (escError) {
      console.error('Error obteniendo escenarios:', escError);
    }
    
    // Organizar escenarios por SKU
    // Estructura: { "Nodo|Cuenta|Sku": { "Venta": {cantidad, precio}, "Descuento_10": {...}, ... } }
    const escenariosPorSku: Record<string, Record<string, { cantidad: number; precio: number }>> = {};
    
    if (escenariosData) {
      escenariosData.forEach((esc: EscenarioRow) => {
        const key = `${esc.Nodo}|${esc.Cuenta}|${esc.Sku_Seller}`;
        if (!escenariosPorSku[key]) {
          escenariosPorSku[key] = {};
        }
        escenariosPorSku[key][esc.Escenario] = {
          cantidad: Number(esc.Cantidad_Venta) || 0,
          precio: Number(esc.Precio_Venta) || 0
        };
      });
    }
    
    // Obtener últimos cambios para mostrar qué escenario tiene aplicado cada SKU
    const { data: ultimosCambios } = await supabase
      .from('historial_cambios_plan')
      .select('Nodo, Cuenta, Sku_Seller, Semana, Escenario_Aplicado, Usuario, created_at')
      .eq('Semana', semanaNum)
      .order('created_at', { ascending: false });
    
    const escenarioAplicadoPorSku: Record<string, { escenario: string; usuario: string; fecha: string }> = {};
    if (ultimosCambios) {
      ultimosCambios.forEach((cambio) => {
        const key = `${cambio.Nodo}|${cambio.Cuenta}|${cambio.Sku_Seller}`;
        if (!escenarioAplicadoPorSku[key]) {
          escenarioAplicadoPorSku[key] = {
            escenario: cambio.Escenario_Aplicado,
            usuario: cambio.Usuario,
            fecha: cambio.created_at
          };
        }
      });
    }
    
    // Obtener listas únicas para filtros
    const nodos = [...new Set(reporteData.map((r: ReportePlanRow) => r.Nodo))].filter(Boolean).sort();
    const cuentas = [...new Set(reporteData.map((r: ReportePlanRow) => r.Cuenta))].filter(Boolean).sort();
    
    // Lista de escenarios disponibles
    const escenariosDisponibles = [
      { value: 'Venta', label: 'Venta (Base)' },
      { value: 'Sobreprecio_5', label: 'Sobreprecio 5%' },
      { value: 'Sobreprecio_10', label: 'Sobreprecio 10%' },
      { value: 'Descuento_5', label: 'Descuento 5%' },
      { value: 'Descuento_10', label: 'Descuento 10%' },
      { value: 'Super_Descuento', label: 'Súper Descuento' }
    ];
    
    return NextResponse.json({
      success: true,
      data: filteredData,
      escenarios_por_sku: escenariosPorSku,
      escenarios_aplicados: escenarioAplicadoPorSku,
      escenarios_disponibles: escenariosDisponibles,
      filtros: {
        nodos,
        cuentas
      },
      meta: {
        total: filteredData.length,
        semana: semanaNum,
        totalEscenarios: escenariosData?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error en GET /api/plan-demanda:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${error}` },
      { status: 500 }
    );
  }
}

// POST: Guardar cambios en Plan_Demanda con auditoría
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      cambios, 
      usuario,
      userAgent,
      ipAddress 
    } = body as {
      cambios: CambioGuardar[];
      usuario: string;
      userAgent?: string;
      ipAddress?: string;
    };
    
    if (!cambios || !Array.isArray(cambios) || cambios.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requiere un array de cambios' },
        { status: 400 }
      );
    }
    
    if (!usuario) {
      return NextResponse.json(
        { success: false, error: 'Se requiere el usuario' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseServer();
    const resultados = {
      actualizados: 0,
      errores: [] as string[]
    };
    
    for (const cambio of cambios) {
      const { Nodo, Cuenta, Sku_Seller, Semana, Plan_demanda, PVP_PD, Accion, Escenario_Aplicado } = cambio;
      
      if (!Nodo || !Cuenta || !Sku_Seller || !Semana) {
        resultados.errores.push(`Registro inválido: faltan campos clave`);
        continue;
      }
      
      // Buscar registro actual en Plan_Demanda
      const { data: registroActual, error: buscarError } = await supabase
        .from('Plan_Demanda')
        .select('Plan_demanda, PVP_PD, Accion')
        .eq('Nodo', Nodo)
        .eq('Cuenta', Cuenta)
        .eq('Sku_Seller', Sku_Seller)
        .eq('Semana', Semana)
        .single();
      
      if (buscarError && buscarError.code !== 'PGRST116') {
        resultados.errores.push(`Error buscando ${Sku_Seller}: ${buscarError.message}`);
        continue;
      }
      
      // Preparar datos para actualizar
      const updateData: Record<string, unknown> = {};
      const cambiosDetalle: Record<string, { anterior: unknown; nuevo: unknown }> = {};
      
      if (Plan_demanda !== undefined) {
        updateData.Plan_demanda = Plan_demanda;
        cambiosDetalle.Plan_demanda = {
          anterior: registroActual?.Plan_demanda,
          nuevo: Plan_demanda
        };
      }
      
      if (PVP_PD !== undefined) {
        updateData.PVP_PD = PVP_PD;
        cambiosDetalle.PVP_PD = {
          anterior: registroActual?.PVP_PD,
          nuevo: PVP_PD
        };
      }
      
      if (Accion !== undefined) {
        updateData.Accion = Accion;
        cambiosDetalle.Accion = {
          anterior: registroActual?.Accion,
          nuevo: Accion
        };
      }
      
      // Actualizar timestamp
      updateData.updated_at = new Date().toISOString();
      
      if (Object.keys(updateData).length <= 1) {
        continue;
      }
      
      // Actualizar Plan_Demanda
      const { error: updateError } = await supabase
        .from('Plan_Demanda')
        .update(updateData)
        .eq('Nodo', Nodo)
        .eq('Cuenta', Cuenta)
        .eq('Sku_Seller', Sku_Seller)
        .eq('Semana', Semana);
      
      if (updateError) {
        resultados.errores.push(`Error actualizando ${Sku_Seller} semana ${Semana}: ${updateError.message}`);
        continue;
      }
      
      resultados.actualizados++;
      
      // Registrar en historial
      const camposModificados = Object.keys(cambiosDetalle);
      await supabase.from('historial_cambios_plan').insert({
        Nodo,
        Cuenta,
        Sku_Seller,
        Semana,
        Campo_Modificado: camposModificados.length === 1 ? camposModificados[0] : 'multiple',
        Valor_Anterior: camposModificados.length === 1 
          ? String(cambiosDetalle[camposModificados[0]].anterior ?? '')
          : null,
        Valor_Nuevo: camposModificados.length === 1 
          ? String(cambiosDetalle[camposModificados[0]].nuevo ?? '')
          : null,
        Cambios_Detalle: camposModificados.length > 1 ? cambiosDetalle : null,
        Escenario_Aplicado: Escenario_Aplicado || 'Carga_Manual',
        Usuario: usuario,
        IP_Address: ipAddress || null,
        User_Agent: userAgent || null
      });
    }
    
    const mensaje = resultados.actualizados > 0
      ? `✅ ${resultados.actualizados} registros actualizados en Plan_Demanda`
      : 'No se realizaron cambios';
    
    return NextResponse.json({
      success: resultados.errores.length === 0,
      message: mensaje,
      resultados
    });
    
  } catch (error) {
    console.error('Error en POST /api/plan-demanda:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${error}` },
      { status: 500 }
    );
  }
}
