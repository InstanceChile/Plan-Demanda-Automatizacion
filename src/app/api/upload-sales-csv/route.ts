import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface SalesRecord {
  semana: number;
  cliente: string;
  seller_sku: string;
  total_vendido: number;
  precio_promedio: number;
  disponibilidad?: number;
}

interface ProcessingResult {
  updated: number;
  inserted: number;
  noSales: number;
  errors: string[];
  details: {
    sku: string;
    cuenta: string;
    action: string;
  }[];
}

// Columnas esperadas para el CSV de ventas
const EXPECTED_COLUMNS = {
  required: [
    { name: 'cliente/cuenta', patterns: ['cliente', 'cuenta'] },
    { name: 'sku/seller_sku', patterns: ['sku', 'seller_sku', 'seller sku'] },
    { name: 'total_vendido/venta', patterns: ['vendido', 'venta', 'total_vendido', 'qty', 'cantidad'] }
  ],
  optional: [
    { name: 'semana', patterns: ['semana', 'week'] },
    { name: 'precio_promedio', patterns: ['precio', 'pvp', 'price', 'precio_promedio'] },
    { name: 'disponibilidad', patterns: ['disponibilidad', 'dips', 'stock'] }
  ]
};

// Función para calcular Error, Error_Abs y Perdida_Valorizada
function calculateMetrics(ventaReal: number | null | undefined, planDemanda: number | null | undefined, pvpProm: number | null | undefined, pvpPd: number | null | undefined) {
  // Convertir null/undefined a 0 y redondear
  // Venta_Real: redondear hacia abajo (floor)
  // Plan_demanda: redondear hacia arriba (ceil)
  const venta = Math.floor(Number(ventaReal) || 0);
  const plan = Math.ceil(Number(planDemanda) || 0);
  const precioProm = Number(pvpProm) || 0;
  const precioPd = Number(pvpPd) || 0;
  
  // Error = Venta_Real - Plan_demanda (resta simple, número entero puro)
  const error = parseInt(String(venta - plan), 10);
  
  // Error_Abs = |Venta_Real - Plan_demanda| (valor absoluto, número entero puro)
  const errorAbs = parseInt(String(Math.abs(error)), 10);

  // Perdida_Valorizada = (Venta_Real - Plan_demanda) × precio (entero redondeado)
  // Si pvpProm = 0, usar pvpPd
  const precioUsar = precioProm > 0 ? precioProm : precioPd;
  const perdidaValorizada = parseInt(String(Math.round(error * precioUsar)), 10);

  return { error, errorAbs, perdidaValorizada };
}

function validateCSVHeaders(headers: string[]): { valid: boolean; missing: string[]; found: string[]; suggestions: string } {
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase().replace(/[_\s]+/g, ''));
  const missing: string[] = [];
  const found: string[] = [];

  for (const col of EXPECTED_COLUMNS.required) {
    const hasColumn = col.patterns.some(pattern => 
      normalizedHeaders.some(h => h.includes(pattern.replace(/[_\s]+/g, '')))
    );
    if (hasColumn) {
      found.push(col.name);
    } else {
      missing.push(col.name);
    }
  }

  let suggestions = '';
  if (missing.length > 0) {
    suggestions = `\n\n📋 Formato esperado del CSV de ventas:\n`;
    suggestions += `   semana, cliente, seller_sku, total_vendido, precio_promedio, disponibilidad\n\n`;
    suggestions += `📌 Ejemplo de primera fila:\n`;
    suggestions += `   202549, Beiersdorf, SKU123, 50, 9990, 85`;
  }

  return {
    valid: missing.length === 0,
    missing,
    found,
    suggestions
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const week = formData.get('week') as string;
    const nodo = formData.get('nodo') as string || 'Mercadolibre_Chile';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No se proporcionó archivo' });
    }

    // Validar extensión del archivo
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.csv')) {
      return NextResponse.json({ 
        success: false, 
        error: `❌ Archivo no válido: "${file.name}"\n\nSe esperaba un archivo .CSV pero se recibió un archivo ${fileName.split('.').pop()?.toUpperCase() || 'sin extensión'}.`,
        errorType: 'invalid_file_type'
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Credenciales de Supabase no configuradas' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Leer el contenido del CSV
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({ 
        success: false, 
        error: '❌ El archivo CSV está vacío o solo tiene encabezados.\n\nAsegúrate de que el archivo tenga datos además de la fila de encabezados.',
        errorType: 'empty_file'
      });
    }

    // Detectar separador (coma o punto y coma)
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    
    // Parsear headers
    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    
    // Validar estructura del CSV
    const validation = validateCSVHeaders(headers);
    
    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        error: `❌ Estructura de CSV incorrecta\n\n` +
               `📁 Archivo: ${file.name}\n` +
               `📊 Columnas encontradas: ${headers.join(', ')}\n\n` +
               `❗ Columnas faltantes: ${validation.missing.join(', ')}` +
               validation.suggestions,
        errorType: 'invalid_structure',
        headers: headers,
        missing: validation.missing
      });
    }
    
    // Mapear columnas esperadas
    const colMap = {
      semana: headers.findIndex(h => h.includes('semana')),
      cliente: headers.findIndex(h => h.includes('cliente') || h.includes('cuenta')),
      seller_sku: headers.findIndex(h => h.includes('sku')),
      total_vendido: headers.findIndex(h => h.includes('vendido') || h.includes('venta') || h.includes('total') || h.includes('qty') || h.includes('cantidad')),
      precio_promedio: headers.findIndex(h => h.includes('precio') || h.includes('pvp')),
      disponibilidad: headers.findIndex(h => h.includes('disponibilidad') || h.includes('dips'))
    };

    const result: ProcessingResult = {
      updated: 0,
      inserted: 0,
      noSales: 0,
      errors: [],
      details: []
    };

    const weekNum = parseInt(week);
    
    // ============================================================
    // PASO 1: Obtener todos los registros existentes de una vez
    // ============================================================
    console.log(`[CSV] Obteniendo registros existentes para semana ${weekNum}, nodo ${nodo}...`);
    
    const { data: existingRecords, error: fetchError } = await supabase
      .from('Plan_Demanda')
      .select('id, Cuenta, Sku_Seller, Plan_demanda, PVP_PD')
      .eq('Semana', weekNum)
      .eq('Nodo', nodo);

    if (fetchError) {
      return NextResponse.json({ success: false, error: `Error obteniendo registros: ${fetchError.message}` });
    }

    // Crear mapa de registros existentes para búsqueda rápida O(1)
    // Guardamos id, Plan_demanda y PVP_PD para calcular errores
    interface ExistingRecord {
      id: number;
      plan_demanda: number;
      pvp_pd: number;
    }
    const existingMap = new Map<string, ExistingRecord>();
    if (existingRecords) {
      for (const record of existingRecords) {
        const key = `${record.Cuenta}|${record.Sku_Seller}`;
        existingMap.set(key, {
          id: record.id,
          plan_demanda: Number(record.Plan_demanda) || 0,
          pvp_pd: Number(record.PVP_PD) || 0
        });
      }
    }
    console.log(`[CSV] Encontrados ${existingMap.size} registros existentes`);
    
    // Debug: mostrar un ejemplo de registro existente
    if (existingMap.size > 0) {
      const firstKey = existingMap.keys().next().value;
      const firstRecord = existingMap.get(firstKey!);
      console.log(`[CSV] Ejemplo registro existente: key=${firstKey}, plan_demanda=${firstRecord?.plan_demanda}, pvp_pd=${firstRecord?.pvp_pd}`);
    }

    // ============================================================
    // PASO 2: Parsear todos los registros del CSV
    // ============================================================
    const skusConVenta = new Set<string>();
    const salesData: SalesRecord[] = [];
    const totalLines = lines.length - 1;

    console.log(`[CSV] Parseando ${totalLines} líneas del CSV...`);

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], separator);
      
      if (values.length < Math.max(colMap.cliente, colMap.seller_sku, colMap.total_vendido) + 1) continue;

      const record: SalesRecord = {
        semana: colMap.semana !== -1 ? parseInt(values[colMap.semana]) : weekNum,
        cliente: values[colMap.cliente]?.trim(),
        seller_sku: values[colMap.seller_sku]?.trim(),
        total_vendido: parseFloat(values[colMap.total_vendido]?.replace(',', '.')) || 0,
        precio_promedio: colMap.precio_promedio !== -1 ? parseFloat(values[colMap.precio_promedio]?.replace(',', '.')) || 0 : 0,
        disponibilidad: colMap.disponibilidad !== -1 ? parseFloat(values[colMap.disponibilidad]?.replace(',', '.')) : undefined
      };

      if (!record.cliente || !record.seller_sku) continue;

      salesData.push(record);
      skusConVenta.add(`${record.cliente}|${record.seller_sku}`);
    }

    console.log(`[CSV] Parseados ${salesData.length} registros válidos`);

    // ============================================================
    // PASO 3: Separar en registros para actualizar vs insertar
    // ============================================================
    const toUpdate: { id: number; data: Record<string, unknown>; sku: string; cuenta: string }[] = [];
    const toInsert: Record<string, unknown>[] = [];

    for (const record of salesData) {
      const key = `${record.cliente}|${record.seller_sku}`;
      const existing = existingMap.get(key);

      if (existing) {
        // Existe, preparar para actualizar con cálculos
        const metrics = calculateMetrics(
          record.total_vendido,
          existing.plan_demanda,
          record.precio_promedio,
          existing.pvp_pd
        );

        // Debug: mostrar primer cálculo
        if (toUpdate.length === 0) {
          console.log(`[CSV] Primer cálculo UPDATE: venta=${record.total_vendido}, plan=${existing.plan_demanda}, pvpProm=${record.precio_promedio}, pvpPd=${existing.pvp_pd}`);
          console.log(`[CSV] Resultado: error=${metrics.error}, errorAbs=${metrics.errorAbs}, perdida=${metrics.perdidaValorizada}`);
        }

        const updateData: Record<string, unknown> = {
          Venta_Real: record.total_vendido,
          PVP_Prom: record.precio_promedio,
          Error: metrics.error,
          Error_Abs: metrics.errorAbs,
          Perdida_Valorizada: metrics.perdidaValorizada,
          updated_at: new Date().toISOString()
        };

        if (record.disponibilidad !== undefined) {
          updateData.Dips = record.disponibilidad;
        }

        toUpdate.push({ id: existing.id, data: updateData, sku: record.seller_sku, cuenta: record.cliente });
      } else {
        // No existe, preparar para insertar
        // Para nuevos registros: Plan_demanda = 0, entonces Error = 1 si hay venta
        const metrics = calculateMetrics(
          record.total_vendido,
          0, // Plan_demanda = 0 para nuevos
          record.precio_promedio,
          record.precio_promedio // Usar precio_promedio como PVP_PD
        );

        toInsert.push({
          Semana: record.semana,
          Nodo: nodo,
          Cuenta: record.cliente,
          Sku_Seller: record.seller_sku,
          Pronostico: 0,
          Plan_demanda: 0,
          PVP_PD: record.precio_promedio,
          Venta_Real: record.total_vendido,
          PVP_Prom: record.precio_promedio,
          Error: metrics.error,
          Error_Abs: metrics.errorAbs,
          Perdida_Valorizada: metrics.perdidaValorizada,
          Dips: record.disponibilidad,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    console.log(`[CSV] Para actualizar: ${toUpdate.length}, Para insertar: ${toInsert.length}`);

    // ============================================================
    // PASO 4: Ejecutar actualizaciones en lotes
    // ============================================================
    const BATCH_SIZE = 50;
    
    // Actualizar en lotes
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      
      // Ejecutar actualizaciones en paralelo dentro del lote
      const updatePromises = batch.map(async (item) => {
        const { error } = await supabase
          .from('Plan_Demanda')
          .update(item.data)
          .eq('id', item.id);
        
        if (error) {
          result.errors.push(`Error actualizando ${item.sku}: ${error.message}`);
          return false;
        }
        return true;
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter(r => r).length;
      result.updated += successCount;

      // Agregar detalles solo de los primeros 50
      if (result.details.length < 50) {
        for (const item of batch.slice(0, 50 - result.details.length)) {
          result.details.push({ sku: item.sku, cuenta: item.cuenta, action: 'actualizado' });
        }
      }

      console.log(`[CSV] Actualizados ${i + batch.length}/${toUpdate.length}`);
    }

    // ============================================================
    // PASO 5: Insertar nuevos registros en lotes
    // ============================================================
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from('Plan_Demanda')
        .insert(batch);

      if (error) {
        result.errors.push(`Error insertando lote: ${error.message}`);
      } else {
        result.inserted += batch.length;
        
        // Agregar detalles solo de los primeros 50
        if (result.details.length < 50) {
          for (const item of batch.slice(0, 50 - result.details.length)) {
            result.details.push({ 
              sku: item.Sku_Seller as string, 
              cuenta: item.Cuenta as string, 
              action: 'insertado (nuevo)' 
            });
          }
        }
      }

      console.log(`[CSV] Insertados ${i + batch.length}/${toInsert.length}`);
    }

    // ============================================================
    // PASO 6: Marcar registros sin venta
    // ============================================================
    // Para registros sin venta: Venta_Real = 0, Error calculado vs Plan_demanda
    interface ZeroRecord {
      id: number;
      plan_demanda: number;
      pvp_pd: number;
      sku: string;
      cuenta: string;
    }
    const toMarkZero: ZeroRecord[] = [];
    
    if (existingRecords) {
      for (const existing of existingRecords) {
        const key = `${existing.Cuenta}|${existing.Sku_Seller}`;
        if (!skusConVenta.has(key)) {
          toMarkZero.push({
            id: existing.id,
            plan_demanda: existing.Plan_demanda || 0,
            pvp_pd: existing.PVP_PD || 0,
            sku: existing.Sku_Seller,
            cuenta: existing.Cuenta
          });
          
          if (result.details.length < 50) {
            result.details.push({
              sku: existing.Sku_Seller,
              cuenta: existing.Cuenta,
              action: 'sin venta (0)'
            });
          }
        }
      }
    }

    // Actualizar a 0 en lotes, calculando el error con la misma fórmula
    for (let i = 0; i < toMarkZero.length; i += BATCH_SIZE) {
      const batch = toMarkZero.slice(i, i + BATCH_SIZE);
      
      // Actualizar cada registro con su error calculado
      const updatePromises = batch.map(async (item) => {
        // Usar la misma función de cálculo: Venta_Real = 0
        const metrics = calculateMetrics(0, item.plan_demanda, 0, item.pvp_pd);

        const { error: updateError } = await supabase
          .from('Plan_Demanda')
          .update({
            Venta_Real: 0,
            PVP_Prom: 0,
            Error: metrics.error,
            Error_Abs: metrics.errorAbs,
            Perdida_Valorizada: metrics.perdidaValorizada,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);

        return !updateError;
      });

      const results = await Promise.all(updatePromises);
      result.noSales += results.filter(r => r).length;

      console.log(`[CSV] Marcados sin venta ${i + batch.length}/${toMarkZero.length}`);
    }

    // ============================================================
    // PASO 7: RECALCULAR TODOS los registros de la semana/nodo
    // Esto asegura que TODOS tengan los cálculos correctos
    // ============================================================
    console.log(`[CSV] PASO 7: Recalculando TODOS los registros de semana ${weekNum}, nodo ${nodo}...`);
    
    const { data: allRecords, error: allFetchError } = await supabase
      .from('Plan_Demanda')
      .select('id, Plan_demanda, PVP_PD, PVP_Prom, Venta_Real')
      .eq('Semana', weekNum)
      .eq('Nodo', nodo);

    if (allFetchError) {
      console.log(`[CSV] Error obteniendo registros: ${allFetchError.message}`);
    } else if (allRecords && allRecords.length > 0) {
      console.log(`[CSV] Recalculando ${allRecords.length} registros...`);
      
      let recalculated = 0;
      let errorsCount = 0;
      
      for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
        const batch = allRecords.slice(i, i + BATCH_SIZE);
        
        const recalcPromises = batch.map(async (record) => {
          // Obtener valores, asegurando que sean números
          const ventaRealRaw = parseFloat(String(record.Venta_Real)) || 0;
          const planDemandaRaw = parseFloat(String(record.Plan_demanda)) || 0;
          const pvpProm = parseFloat(String(record.PVP_Prom)) || 0;
          const pvpPd = parseFloat(String(record.PVP_PD)) || 0;
          
          // Redondear: Venta_Real hacia abajo (floor), Plan_demanda hacia arriba (ceil)
          const ventaReal = Math.floor(ventaRealRaw);
          const planDemanda = Math.ceil(planDemandaRaw);
          
          // Calcular métricas: Error = Venta_Real - Plan_demanda (números enteros)
          // Usar parseInt para forzar enteros sin decimales
          const errorVal = parseInt(String(ventaReal - planDemanda), 10);
          const errorAbsVal = parseInt(String(Math.abs(errorVal)), 10);
          const precioUsar = pvpProm > 0 ? pvpProm : pvpPd;
          const perdidaVal = parseInt(String(Math.round(errorVal * precioUsar)), 10);
          
          // Debug: mostrar algunos registros para verificar
          if (i === 0 && batch.indexOf(record) < 3) {
            console.log(`[CSV] Debug id=${record.id}: Venta_Real=${ventaRealRaw}->${ventaReal}, Plan_demanda=${planDemandaRaw}->${planDemanda}`);
            console.log(`[CSV]        -> error=${errorVal}, errorAbs=${errorAbsVal}, perdida=${perdidaVal}`);
          }
          
          // Preparar datos de actualización - valores enteros puros, nunca null
          const updateData = {
            Error: isNaN(errorVal) ? 0 : errorVal,
            Error_Abs: isNaN(errorAbsVal) ? 0 : errorAbsVal,
            Perdida_Valorizada: isNaN(perdidaVal) ? 0 : perdidaVal,
            updated_at: new Date().toISOString()
          };
          
          const { error: recalcError } = await supabase
            .from('Plan_Demanda')
            .update(updateData)
            .eq('id', record.id);
          
          if (recalcError) {
            console.log(`[CSV] Error actualizando id=${record.id}: ${recalcError.message}`);
            return false;
          }
          return true;
        });
        
        const recalcResults = await Promise.all(recalcPromises);
        recalculated += recalcResults.filter(r => r).length;
        errorsCount += recalcResults.filter(r => !r).length;
        
        console.log(`[CSV] Progreso: ${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length}`);
      }
      
      console.log(`[CSV] ✅ Recalculados ${recalculated} registros, ${errorsCount} errores`);
    } else {
      console.log(`[CSV] No hay registros para recalcular`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CSV] ✅ Proceso completado en ${duration}s`);

    return NextResponse.json({ 
      success: true, 
      updated: result.updated,
      inserted: result.inserted,
      noSales: result.noSales,
      total: result.updated + result.inserted + result.noSales,
      duration: `${duration}s`,
      errors: result.errors.length > 0 ? result.errors.slice(0, 10) : undefined,
      details: result.details.slice(0, 50),
      message: `Procesado: ${result.updated} actualizados, ${result.inserted} nuevos insertados, ${result.noSales} sin venta (${duration}s)`
    });

  } catch (error) {
    console.error('Error processing CSV:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
}

// Función para parsear líneas CSV correctamente (maneja comillas)
function parseCSVLine(line: string, separator: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
