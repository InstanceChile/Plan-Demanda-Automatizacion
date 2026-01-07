import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface PlanRecord {
  semana: number;
  nodo: string;
  cuenta: string;
  sku_seller: string;
  pronostico: number;
  plan_demanda: number;
  pvp_pd: number;
  accion?: string;
  observaciones?: string;
}

// Columnas esperadas para el CSV de plan
const EXPECTED_COLUMNS = {
  required: [
    { name: 'cuenta/cliente', patterns: ['cuenta', 'cliente'] },
    { name: 'sku/seller_sku', patterns: ['sku', 'seller_sku', 'seller sku'] }
  ],
  optional: [
    { name: 'semana', patterns: ['semana', 'week'] },
    { name: 'nodo', patterns: ['nodo', 'canal'] },
    { name: 'pronostico', patterns: ['pronostico', 'pronóstico', 'forecast'] },
    { name: 'plan_demanda', patterns: ['plan', 'demanda', 'plan_demanda'] },
    { name: 'pvp_pd', patterns: ['pvp', 'precio'] },
    { name: 'accion', patterns: ['accion', 'acción'] },
    { name: 'observaciones', patterns: ['obs', 'nota', 'observ'] }
  ]
};

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
    suggestions = `\n\n📋 Formato esperado del CSV de Plan de Demanda:\n`;
    suggestions += `   Semana, Nodo, Cuenta, Sku_Seller, Pronostico, Plan_demanda, PVP_PD, Accion, Observaciones\n\n`;
    suggestions += `📌 Ejemplo de primera fila:\n`;
    suggestions += `   202549, Mercadolibre_Chile, Beiersdorf, SKU123, 100, 95, 9990, Mantener, Sin observaciones`;
  }

  return {
    valid: missing.length === 0,
    missing,
    found,
    suggestions
  };
}

export async function POST(request: NextRequest) {
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

    // Detectar separador
    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    
    // Parsear headers
    const headers = firstLine.split(separator).map(h => h.trim().toLowerCase());
    
    // Validar estructura del CSV
    const validation = validateCSVHeaders(headers);
    
    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        error: `❌ Estructura de CSV incorrecta para Plan de Demanda\n\n` +
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
      nodo: headers.findIndex(h => h.includes('nodo')),
      cuenta: headers.findIndex(h => h.includes('cuenta') || h.includes('cliente')),
      sku_seller: headers.findIndex(h => h.includes('sku')),
      pronostico: headers.findIndex(h => h.includes('pronostico') || h.includes('pronóstico')),
      plan_demanda: headers.findIndex(h => h.includes('plan') || h.includes('demanda')),
      pvp_pd: headers.findIndex(h => h.includes('pvp') || h.includes('precio')),
      accion: headers.findIndex(h => h.includes('accion') || h.includes('acción')),
      observaciones: headers.findIndex(h => h.includes('obs') || h.includes('nota'))
    };

    const weekNum = parseInt(week);
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];
    const details: { sku: string; cuenta: string; action: string }[] = [];

    // Procesar cada línea
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      
      if (values.length < 2) continue;

      const record: PlanRecord = {
        semana: colMap.semana !== -1 ? parseInt(values[colMap.semana]) : weekNum,
        nodo: colMap.nodo !== -1 ? values[colMap.nodo]?.trim() : nodo,
        cuenta: values[colMap.cuenta]?.trim(),
        sku_seller: values[colMap.sku_seller]?.trim(),
        pronostico: colMap.pronostico !== -1 ? parseFloat(values[colMap.pronostico]?.replace(',', '.')) || 0 : 0,
        plan_demanda: colMap.plan_demanda !== -1 ? parseFloat(values[colMap.plan_demanda]?.replace(',', '.')) || 0 : 0,
        pvp_pd: colMap.pvp_pd !== -1 ? parseFloat(values[colMap.pvp_pd]?.replace(',', '.')) || 0 : 0,
        accion: colMap.accion !== -1 ? values[colMap.accion]?.trim() : undefined,
        observaciones: colMap.observaciones !== -1 ? values[colMap.observaciones]?.trim() : undefined
      };

      if (!record.cuenta || !record.sku_seller) continue;

      // Usar upsert para insertar o actualizar
      const insertData = {
        Semana: record.semana,
        Nodo: record.nodo,
        Cuenta: record.cuenta,
        Sku_Seller: record.sku_seller,
        Pronostico: record.pronostico,
        Plan_demanda: record.plan_demanda,
        PVP_PD: record.pvp_pd,
        Accion: record.accion,
        Observaciones: record.observaciones,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabase
        .from('Plan_Demanda')
        .upsert(insertData, {
          onConflict: 'Semana,Nodo,Cuenta,Sku_Seller'
        });

      if (upsertError) {
        // Intentar insertar directamente si el upsert falla
        const { error: insertError } = await supabase
          .from('Plan_Demanda')
          .insert(insertData);
        
        if (insertError) {
          errors.push(`Fila ${i + 1}: ${insertError.message}`);
        } else {
          inserted++;
          details.push({ sku: record.sku_seller, cuenta: record.cuenta, action: 'insertado' });
        }
      } else {
        inserted++;
        details.push({ sku: record.sku_seller, cuenta: record.cuenta, action: 'insertado/actualizado' });
      }
    }

    return NextResponse.json({ 
      success: true, 
      inserted,
      updated,
      total: inserted + updated,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      details: details.slice(0, 50),
      message: `Plan cargado: ${inserted} registros procesados`
    });

  } catch (error) {
    console.error('Error processing plan CSV:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
}

// Función para parsear líneas CSV correctamente
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

