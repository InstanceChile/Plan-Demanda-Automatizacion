import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Función para obtener el lunes de una semana en formato YYYYWW
function getMondayOfWeek(yearWeek: number): Date {
  const year = Math.floor(yearWeek / 100);
  const week = yearWeek % 100;
  
  // Obtener el 4 de enero del año (siempre está en la semana 1 según ISO)
  const jan4 = new Date(year, 0, 4);
  
  // Obtener el lunes de la semana 1
  const dayOfWeek = jan4.getDay() || 7; // Domingo = 7
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - dayOfWeek + 1);
  
  // Sumar las semanas necesarias
  const targetMonday = new Date(mondayWeek1);
  targetMonday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  
  return targetMonday;
}

// Formatear fecha como YYYY-MM-DD
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Formatear fecha como DD-MM-YYYY (formato común en Chile/Latam)
function formatDateDMY(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}-${month}-${year}`;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
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
    const weekNum = parseInt(week);
    const nodoValue = nodo || 'Mercadolibre_Chile';

    // ============================================================
    // PASO 1: Calcular el lunes de la semana
    // ============================================================
    const mondayDate = getMondayOfWeek(weekNum);
    const mondayStrISO = formatDateISO(mondayDate);  // 2025-12-01
    const mondayStrDMY = formatDateDMY(mondayDate);  // 01-12-2025
    
    console.log(`[STOCK] Semana ${weekNum} -> Lunes: ${mondayStrISO} (o ${mondayStrDMY})`);

    // ============================================================
    // PASO 2: Obtener datos de StockMeli para el lunes y país Chile
    // ============================================================
    console.log(`[STOCK] Buscando stock en StockMeli para fecha ${mondayStrISO} o ${mondayStrDMY}, pais=Chile...`);
    
    // Primero verificar si la tabla StockMeli existe y tiene datos
    const { data: tableCheck, error: tableError } = await supabase
      .from('StockMeli')
      .select('Fecha')
      .limit(1);
    
    if (tableError) {
      console.log(`[STOCK] Error accediendo a StockMeli: ${tableError.message}`);
      return NextResponse.json({ 
        success: false, 
        error: `❌ Error accediendo a la tabla StockMeli: ${tableError.message}\n\nVerifica que la tabla exista en Supabase.`,
        errorType: 'table_error'
      });
    }

    // Buscar datos para la fecha en formato ISO (YYYY-MM-DD)
    let { data: stockData, error: stockError } = await supabase
      .from('StockMeli')
      .select('sku, stock, cliente, Fecha')
      .eq('Fecha', mondayStrISO)
      .eq('pais', 'Chile');

    // Si no encuentra, buscar en formato DD-MM-YYYY
    if ((!stockData || stockData.length === 0) && !stockError) {
      console.log(`[STOCK] No encontrado con formato ISO, buscando con formato DD-MM-YYYY...`);
      const result = await supabase
        .from('StockMeli')
        .select('sku, stock, cliente, Fecha')
        .eq('Fecha', mondayStrDMY)
        .eq('pais', 'Chile');
      
      stockData = result.data;
      stockError = result.error;
    }

    if (stockError) {
      console.log(`[STOCK] Error consultando StockMeli: ${stockError.message}`);
      return NextResponse.json({ 
        success: false, 
        error: `❌ Error consultando StockMeli: ${stockError.message}` 
      });
    }

    // Variable para guardar el formato de fecha encontrado
    const mondayStr = stockData && stockData.length > 0 ? stockData[0].Fecha : mondayStrISO;

    // Si no hay datos, buscar qué fechas SÍ tienen datos para ayudar al usuario
    if (!stockData || stockData.length === 0) {
      console.log(`[STOCK] No hay datos de stock para la fecha ${mondayStrISO} ni ${mondayStrDMY}`);
      
      // Buscar fechas disponibles en StockMeli
      const { data: availableDates } = await supabase
        .from('StockMeli')
        .select('Fecha')
        .eq('pais', 'Chile')
        .order('Fecha', { ascending: false })
        .limit(10);
      
      const fechasDisponibles = availableDates 
        ? [...new Set(availableDates.map(d => d.Fecha))].slice(0, 5)
        : [];
      
      let errorMsg = `❌ No hay datos de stock cargados para el lunes de la semana ${weekNum}.`;
      errorMsg += `\n\n📅 Fechas buscadas:\n   • ${mondayStrISO} (formato ISO)\n   • ${mondayStrDMY} (formato DD-MM-YYYY)`;
      
      if (fechasDisponibles.length > 0) {
        errorMsg += `\n\n📅 Fechas con datos disponibles en StockMeli:\n${fechasDisponibles.map(f => `   • ${f}`).join('\n')}`;
      } else {
        errorMsg += `\n\n⚠️ La tabla StockMeli no tiene datos para Chile.`;
      }
      
      errorMsg += `\n\n💡 Carga los datos de stock para la fecha correcta en la tabla StockMeli.`;
      
      return NextResponse.json({ 
        success: false, 
        error: errorMsg,
        errorType: 'no_stock_data',
        mondayDateISO: mondayStrISO,
        mondayDateDMY: mondayStrDMY,
        availableDates: fechasDisponibles
      });
    }

    console.log(`[STOCK] ✅ Encontrados ${stockData.length} registros de stock para ${mondayStr}`);

    // Crear mapa de stock por SKU para búsqueda rápida
    const stockMap = new Map<string, { stock: number; cliente: string }>();
    for (const item of stockData) {
      if (item.sku) {
        stockMap.set(item.sku, {
          stock: Number(item.stock) || 0,
          cliente: item.cliente || ''
        });
      }
    }

    // ============================================================
    // PASO 3: Obtener registros existentes de Plan_Demanda
    // ============================================================
    console.log(`[STOCK] Obteniendo registros de Plan_Demanda para semana ${weekNum}, nodo ${nodoValue}...`);
    
    const { data: planRecords, error: planError } = await supabase
      .from('Plan_Demanda')
      .select('id, Sku_Seller, Cuenta')
      .eq('Semana', weekNum)
      .eq('Nodo', nodoValue);

    if (planError) {
      return NextResponse.json({ 
        success: false, 
        error: `Error obteniendo Plan_Demanda: ${planError.message}` 
      });
    }

    // Crear set de SKUs existentes en el plan
    const existingSkus = new Set<string>();
    if (planRecords) {
      for (const record of planRecords) {
        if (record.Sku_Seller) {
          existingSkus.add(record.Sku_Seller);
        }
      }
    }

    console.log(`[STOCK] Encontrados ${planRecords?.length || 0} registros en Plan_Demanda`);

    // ============================================================
    // PASO 4: Actualizar Stock_Inicio_Semana para registros existentes
    // ============================================================
    let updated = 0;
    let inserted = 0;
    let notFound = 0;
    const BATCH_SIZE = 50;

    if (planRecords && planRecords.length > 0) {
      console.log(`[STOCK] Actualizando Stock_Inicio_Semana...`);
      
      for (let i = 0; i < planRecords.length; i += BATCH_SIZE) {
        const batch = planRecords.slice(i, i + BATCH_SIZE);
        
        const updatePromises = batch.map(async (record) => {
          const stockInfo = stockMap.get(record.Sku_Seller);
          
          // Si tiene coincidencia en StockMeli, usar ese valor; si no, poner 0
          const stockValue = stockInfo ? stockInfo.stock : 0;
          
          const { error: updateError } = await supabase
            .from('Plan_Demanda')
            .update({
              Stock_Inicio_Semana: stockValue,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
          
          if (!updateError) {
            return stockInfo ? 'updated' : 'zero';
          }
          return 'error';
        });
        
        const results = await Promise.all(updatePromises);
        updated += results.filter(r => r === 'updated').length;
        notFound += results.filter(r => r === 'zero').length;
        
        console.log(`[STOCK] Progreso actualización: ${Math.min(i + BATCH_SIZE, planRecords.length)}/${planRecords.length}`);
      }
    }

    // ============================================================
    // PASO 5: Insertar SKUs con stock que no están en el plan
    // ============================================================
    console.log(`[STOCK] Buscando SKUs con stock que no están en el plan...`);
    
    const skusToInsert: { sku: string; stock: number; cliente: string }[] = [];
    
    for (const [sku, info] of stockMap) {
      if (!existingSkus.has(sku) && info.stock > 0) {
        skusToInsert.push({
          sku,
          stock: info.stock,
          cliente: info.cliente
        });
      }
    }

    console.log(`[STOCK] Encontrados ${skusToInsert.length} SKUs con stock sin plan`);

    if (skusToInsert.length > 0) {
      for (let i = 0; i < skusToInsert.length; i += BATCH_SIZE) {
        const batch = skusToInsert.slice(i, i + BATCH_SIZE);
        
        // Nodo siempre es el seleccionado (Mercadolibre_Chile por defecto)
        const insertData = batch.map(item => ({
          Semana: weekNum,
          Nodo: nodoValue, // Usa el nodo seleccionado en la interfaz
          Cuenta: item.cliente,
          Sku_Seller: item.sku,
          Pronostico: 0,
          Plan_demanda: 0,
          PVP_PD: 0,
          Accion: '0',
          Observaciones: 'Producto con stock sin plan',
          Venta_Real: 0,
          PVP_Prom: 0,
          Error: 0,
          Error_Abs: 0,
          Dips: 0,
          Stock_Inicio_Semana: item.stock,
          Perdida_Valorizada: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        const { error: insertError } = await supabase
          .from('Plan_Demanda')
          .insert(insertData);
        
        if (insertError) {
          console.log(`[STOCK] Error insertando lote: ${insertError.message}`);
        } else {
          inserted += batch.length;
        }
        
        console.log(`[STOCK] Progreso inserción: ${Math.min(i + BATCH_SIZE, skusToInsert.length)}/${skusToInsert.length}`);
      }
    }

    // ============================================================
    // PASO 6: Barrido final - Actualizar a 0 todos los Stock_Inicio_Semana = NULL
    // ============================================================
    console.log(`[STOCK] PASO 6: Barrido final - Actualizando TODOS los registros con Stock_Inicio_Semana = NULL...`);
    
    // Primero contar cuántos hay
    const { count: nullCount, error: countError } = await supabase
      .from('Plan_Demanda')
      .select('*', { count: 'exact', head: true })
      .eq('Semana', weekNum)
      .eq('Nodo', nodoValue)
      .is('Stock_Inicio_Semana', null);

    console.log(`[STOCK] Registros con NULL encontrados: ${nullCount || 0}`);

    let nullUpdated = 0;

    if (countError) {
      console.log(`[STOCK] Error contando registros NULL: ${countError.message}`);
    } else if (nullCount && nullCount > 0) {
      // Actualizar directamente todos los NULL de una vez
      const { error: updateNullError, count: updatedCount } = await supabase
        .from('Plan_Demanda')
        .update({
          Stock_Inicio_Semana: 0,
          updated_at: new Date().toISOString()
        }, { count: 'exact' })
        .eq('Semana', weekNum)
        .eq('Nodo', nodoValue)
        .is('Stock_Inicio_Semana', null);
      
      if (updateNullError) {
        console.log(`[STOCK] Error actualizando NULL: ${updateNullError.message}`);
        
        // Intentar método alternativo: obtener IDs y actualizar uno por uno
        console.log(`[STOCK] Intentando método alternativo...`);
        
        const { data: nullRecords } = await supabase
          .from('Plan_Demanda')
          .select('id, Stock_Inicio_Semana')
          .eq('Semana', weekNum)
          .eq('Nodo', nodoValue);
        
        if (nullRecords) {
          const recordsWithNull = nullRecords.filter(r => r.Stock_Inicio_Semana === null);
          console.log(`[STOCK] Encontrados ${recordsWithNull.length} registros con Stock NULL (método alternativo)`);
          
          for (let i = 0; i < recordsWithNull.length; i += BATCH_SIZE) {
            const batch = recordsWithNull.slice(i, i + BATCH_SIZE);
            
            const updatePromises = batch.map(async (record) => {
              const { error } = await supabase
                .from('Plan_Demanda')
                .update({ 
                  Stock_Inicio_Semana: 0,
                  updated_at: new Date().toISOString()
                })
                .eq('id', record.id);
              return !error;
            });
            
            const results = await Promise.all(updatePromises);
            nullUpdated += results.filter(r => r).length;
            
            console.log(`[STOCK] Barrido NULL: ${Math.min(i + BATCH_SIZE, recordsWithNull.length)}/${recordsWithNull.length}`);
          }
        }
      } else {
        nullUpdated = updatedCount || 0;
        console.log(`[STOCK] ✅ Actualizados ${nullUpdated} registros de NULL a 0`);
      }
    } else {
      console.log(`[STOCK] ✅ No hay registros con Stock_Inicio_Semana = NULL`);
    }

    // ============================================================
    // PASO 7: Calcular Venta_Perdida_Stock y Perdida_Stock_Valorizada
    // ============================================================
    console.log(`[STOCK] PASO 7: Calculando Venta_Perdida_Stock y Perdida_Stock_Valorizada...`);
    
    // Obtener todos los registros para calcular
    const { data: allRecordsForCalc, error: calcFetchError } = await supabase
      .from('Plan_Demanda')
      .select('id, Error, Stock_Inicio_Semana, Plan_demanda, Venta_Real, PVP_Prom, PVP_PD')
      .eq('Semana', weekNum)
      .eq('Nodo', nodoValue);

    let calculated = 0;

    if (calcFetchError) {
      console.log(`[STOCK] Error obteniendo registros para cálculo: ${calcFetchError.message}`);
    } else if (allRecordsForCalc && allRecordsForCalc.length > 0) {
      console.log(`[STOCK] Calculando para ${allRecordsForCalc.length} registros...`);
      
      for (let i = 0; i < allRecordsForCalc.length; i += BATCH_SIZE) {
        const batch = allRecordsForCalc.slice(i, i + BATCH_SIZE);
        
        const calcPromises = batch.map(async (record) => {
          // Manejar valores null correctamente
          // Para Error: si es null, tratarlo como 0 (no negativo)
          const errorRaw = record.Error;
          const error = errorRaw !== null && errorRaw !== undefined ? Number(errorRaw) : 0;
          
          const stockInicioSemana = Number(record.Stock_Inicio_Semana) || 0;
          const planDemanda = Number(record.Plan_demanda) || 0;
          const ventaReal = Number(record.Venta_Real) || 0;
          const pvpProm = Number(record.PVP_Prom) || 0;
          const pvpPd = Number(record.PVP_PD) || 0;
          
          // Calcular Venta_Perdida_Stock
          // SI(Error<0; SI(Stock_Inicio_Sem<Plan_Demanda; SI(Venta_Real>=Stock_Inicio_Sem; -Plan_Demanda+Stock_Inicio_Sem; 0); 0); 0)
          let ventaPerdidaStock = 0;
          
          // Evaluar condiciones paso a paso
          const cond1 = error < 0;
          const cond2 = stockInicioSemana < planDemanda;
          const cond3 = ventaReal >= stockInicioSemana;
          
          if (cond1 && cond2 && cond3) {
            ventaPerdidaStock = -planDemanda + stockInicioSemana;
          }
          
          // Redondear a entero
          ventaPerdidaStock = parseInt(String(Math.round(ventaPerdidaStock)), 10);
          
          // Calcular Perdida_Stock_Valorizada
          // Venta_Perdida_Stock × precio (PVP_Prom si > 0, sino PVP_PD)
          const precioUsar = pvpProm > 0 ? pvpProm : pvpPd;
          const perdidaStockValorizada = parseInt(String(Math.round(ventaPerdidaStock * precioUsar)), 10);
          
          // Debug: mostrar casos donde Error < 0 y Stock = 0
          if (error < 0 && stockInicioSemana === 0 && batch.indexOf(record) < 3) {
            console.log(`[STOCK] CASO CRÍTICO id=${record.id}: Error=${error}, Stock=${stockInicioSemana}, Plan=${planDemanda}, Venta=${ventaReal}`);
            console.log(`[STOCK]   Condiciones: Error<0=${cond1}, Stock<Plan=${cond2}, Venta>=Stock=${cond3}`);
            console.log(`[STOCK]   -> Venta_Perdida_Stock=${ventaPerdidaStock}, Perdida_Stock_Valorizada=${perdidaStockValorizada}`);
          }
          
          const { error: updateError } = await supabase
            .from('Plan_Demanda')
            .update({
              Venta_Perdida_Stock: ventaPerdidaStock,
              Perdida_Stock_Valorizada: perdidaStockValorizada,
              updated_at: new Date().toISOString()
            })
            .eq('id', record.id);
          
          return !updateError;
        });
        
        const results = await Promise.all(calcPromises);
        calculated += results.filter(r => r).length;
        
        console.log(`[STOCK] Progreso cálculo: ${Math.min(i + BATCH_SIZE, allRecordsForCalc.length)}/${allRecordsForCalc.length}`);
      }
      
      console.log(`[STOCK] ✅ Calculados ${calculated} registros`);
    }

    // ============================================================
    // PASO 8: Barrido final - Asegurar que no queden NULL en los cálculos
    // ============================================================
    console.log(`[STOCK] PASO 8: Barrido final - Actualizando campos NULL a 0...`);
    
    // Obtener TODOS los registros y actualizar los que tengan NULL en cualquier campo de cálculo
    const { data: allRecordsForCleanup, error: cleanupFetchError } = await supabase
      .from('Plan_Demanda')
      .select('id, Venta_Perdida_Stock, Perdida_Stock_Valorizada, Stock_Inicio_Semana, Error, Error_Abs, Perdida_Valorizada')
      .eq('Semana', weekNum)
      .eq('Nodo', nodoValue);

    let cleanedUp = 0;

    if (cleanupFetchError) {
      console.log(`[STOCK] Error en barrido final: ${cleanupFetchError.message}`);
    } else if (allRecordsForCleanup && allRecordsForCleanup.length > 0) {
      // Filtrar registros que tienen algún NULL
      const recordsWithNull = allRecordsForCleanup.filter(r => 
        r.Venta_Perdida_Stock === null || 
        r.Perdida_Stock_Valorizada === null ||
        r.Stock_Inicio_Semana === null ||
        r.Error === null ||
        r.Error_Abs === null ||
        r.Perdida_Valorizada === null
      );

      if (recordsWithNull.length > 0) {
        console.log(`[STOCK] Encontrados ${recordsWithNull.length} registros con campos NULL para limpiar`);
        
        for (let i = 0; i < recordsWithNull.length; i += BATCH_SIZE) {
          const batch = recordsWithNull.slice(i, i + BATCH_SIZE);
          
          const cleanupPromises = batch.map(async (record) => {
            const updateData: Record<string, unknown> = {
              updated_at: new Date().toISOString()
            };
            
            // Solo actualizar los campos que son NULL
            if (record.Venta_Perdida_Stock === null) updateData.Venta_Perdida_Stock = 0;
            if (record.Perdida_Stock_Valorizada === null) updateData.Perdida_Stock_Valorizada = 0;
            if (record.Stock_Inicio_Semana === null) updateData.Stock_Inicio_Semana = 0;
            if (record.Error === null) updateData.Error = 0;
            if (record.Error_Abs === null) updateData.Error_Abs = 0;
            if (record.Perdida_Valorizada === null) updateData.Perdida_Valorizada = 0;
            
            const { error: cleanupError } = await supabase
              .from('Plan_Demanda')
              .update(updateData)
              .eq('id', record.id);
            
            return !cleanupError;
          });
          
          const results = await Promise.all(cleanupPromises);
          cleanedUp += results.filter(r => r).length;
          
          console.log(`[STOCK] Barrido limpieza: ${Math.min(i + BATCH_SIZE, recordsWithNull.length)}/${recordsWithNull.length}`);
        }
        
        console.log(`[STOCK] ✅ Limpiados ${cleanedUp} registros con NULL`);
      } else {
        console.log(`[STOCK] ✅ No hay registros con campos NULL`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[STOCK] ✅ Proceso completado en ${duration}s`);

    return NextResponse.json({ 
      success: true, 
      updated,
      inserted,
      notFound: notFound + nullUpdated,
      nullUpdated,
      calculated,
      totalStock: stockData.length,
      mondayDate: mondayStr,
      duration: `${duration}s`,
      message: `Stock actualizado: ${updated} con stock, ${inserted} nuevos, ${notFound + nullUpdated} sin stock (→0), ${calculated} cálculos (${duration}s)`
    });

  } catch (error) {
    console.error('Error updating stock:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
}

