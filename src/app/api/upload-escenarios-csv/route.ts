import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

// Escenarios válidos
const ESCENARIOS_VALIDOS = [
  'Venta',
  'Sobreprecio_5',
  'Sobreprecio_10',
  'Descuento_5',
  'Descuento_10',
  'Super_Descuento'
];

// Columnas requeridas en el CSV
const COLUMNAS_REQUERIDAS = [
  'Nodo',
  'Cuenta', 
  'Sku_Seller',
  'Escenario',
  'Cantidad_Venta',
  'Precio_Venta'
];

interface EscenarioRow {
  Nodo: string;
  Cuenta: string;
  Sku_Seller: string;
  Escenario: string;
  Cantidad_Venta: number;
  Precio_Venta: number;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

function parseNumber(value: string): number {
  if (!value) return 0;
  // Remover puntos de miles y cambiar coma decimal por punto
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No se recibió archivo' },
        { status: 400 }
      );
    }
    
    // Validar tipo de archivo
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({
        success: false,
        error: 'El archivo debe ser CSV',
        errorType: 'invalid_file_type'
      }, { status: 400 });
    }
    
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    
    if (lines.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'El archivo está vacío o solo tiene encabezados',
        errorType: 'empty_file'
      }, { status: 400 });
    }
    
    // Parsear encabezados
    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    
    // Validar columnas requeridas
    const missingColumns = COLUMNAS_REQUERIDAS.filter(col => 
      !headers.some(h => h.toLowerCase() === col.toLowerCase())
    );
    
    if (missingColumns.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Columnas faltantes: ${missingColumns.join(', ')}\n\nColumnas requeridas:\n${COLUMNAS_REQUERIDAS.join(', ')}\n\nColumnas encontradas:\n${headers.join(', ')}`,
        errorType: 'invalid_structure',
        headers,
        missing: missingColumns
      }, { status: 400 });
    }
    
    // Mapear índices de columnas (case insensitive)
    const colIndex: Record<string, number> = {};
    COLUMNAS_REQUERIDAS.forEach(col => {
      const idx = headers.findIndex(h => h.toLowerCase() === col.toLowerCase());
      colIndex[col] = idx;
    });
    
    // Parsear filas
    const registros: EscenarioRow[] = [];
    const erroresLinea: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = parseCSVLine(line);
      
      const nodo = values[colIndex['Nodo']]?.trim();
      const cuenta = values[colIndex['Cuenta']]?.trim();
      const skuSeller = values[colIndex['Sku_Seller']]?.trim();
      const escenario = values[colIndex['Escenario']]?.trim();
      const cantidadVenta = parseNumber(values[colIndex['Cantidad_Venta']]);
      const precioVenta = parseNumber(values[colIndex['Precio_Venta']]);
      
      // Validaciones
      if (!nodo || !cuenta || !skuSeller) {
        erroresLinea.push(`Línea ${i + 1}: Nodo, Cuenta o Sku_Seller vacío`);
        continue;
      }
      
      if (!escenario || !ESCENARIOS_VALIDOS.includes(escenario)) {
        erroresLinea.push(`Línea ${i + 1}: Escenario inválido "${escenario}". Valores válidos: ${ESCENARIOS_VALIDOS.join(', ')}`);
        continue;
      }
      
      if (cantidadVenta < 0 || precioVenta < 0) {
        erroresLinea.push(`Línea ${i + 1}: Cantidad o Precio negativos`);
        continue;
      }
      
      registros.push({
        Nodo: nodo,
        Cuenta: cuenta,
        Sku_Seller: skuSeller,
        Escenario: escenario,
        Cantidad_Venta: cantidadVenta,
        Precio_Venta: precioVenta
      });
    }
    
    if (registros.length === 0) {
      return NextResponse.json({
        success: false,
        error: `No se encontraron registros válidos.\n\nErrores:\n${erroresLinea.slice(0, 10).join('\n')}`,
        errorType: 'no_valid_records'
      }, { status: 400 });
    }
    
    const supabase = getSupabaseServer();
    
    // Insertar/actualizar en lotes
    const BATCH_SIZE = 100;
    let insertados = 0;
    let actualizados = 0;
    const erroresDB: string[] = [];
    
    for (let i = 0; i < registros.length; i += BATCH_SIZE) {
      const batch = registros.slice(i, i + BATCH_SIZE);
      
      for (const registro of batch) {
        // Usar upsert (insert or update)
        const { error } = await supabase
          .from('escenarios_plan_demanda')
          .upsert({
            Nodo: registro.Nodo,
            Cuenta: registro.Cuenta,
            Sku_Seller: registro.Sku_Seller,
            Escenario: registro.Escenario,
            Cantidad_Venta: registro.Cantidad_Venta,
            Precio_Venta: registro.Precio_Venta
          }, {
            onConflict: 'Nodo,Cuenta,Sku_Seller,Escenario'
          });
        
        if (error) {
          erroresDB.push(`${registro.Sku_Seller}/${registro.Escenario}: ${error.message}`);
        } else {
          // No podemos saber si fue insert o update con upsert simple
          insertados++;
        }
      }
    }
    
    console.log(`Escenarios importados: ${insertados}, Errores: ${erroresDB.length}`);
    
    return NextResponse.json({
      success: true,
      message: `Escenarios importados correctamente`,
      inserted: insertados,
      erroresLinea: erroresLinea.length,
      erroresDB: erroresDB.length,
      details: erroresLinea.slice(0, 5),
      totalProcesados: registros.length
    });
    
  } catch (error) {
    console.error('Error en POST /api/upload-escenarios-csv:', error);
    return NextResponse.json(
      { success: false, error: `Error interno: ${error}` },
      { status: 500 }
    );
  }
}

