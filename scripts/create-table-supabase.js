/**
 * Script para crear la tabla Plan_Demanda en Supabase
 */

require('dotenv').config({ path: 'env' });
const { createClient } = require('@supabase/supabase-js');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

async function createTable() {
  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   CREANDO TABLA PLAN_DEMANDA EN SUPABASE          ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // SQL para crear la tabla
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS "Plan_Demanda" (
      -- ID autoincremental
      id BIGSERIAL PRIMARY KEY,
      
      -- Datos iniciales (carga manual)
      "Semana" INTEGER NOT NULL,
      "Nodo" TEXT,
      "Cuenta" TEXT NOT NULL,
      "Sku_Seller" TEXT NOT NULL,
      "Pronostico" NUMERIC(12,2),
      "Plan_demanda" NUMERIC(12,2),
      "PVP_PD" NUMERIC(12,2),
      "Accion" TEXT,
      "Observaciones" TEXT,
      
      -- Primera actualización (desde MySQL - ventas reales)
      "Venta_Real" NUMERIC(12,2),
      "PVP_Prom" NUMERIC(12,2),
      "Error" NUMERIC(12,4),
      "Error_Abs" NUMERIC(12,4),
      "Dips" NUMERIC(12,2),
      
      -- Campos adicionales de análisis
      "Stock_Inicio_Semana" NUMERIC(12,2),
      "Venta_Perdida_Stock" NUMERIC(12,2),
      "Fill_Rate" NUMERIC(8,4),
      "Fecha_Ultima_Oc" DATE,
      "Perdida_Fill_Rate" NUMERIC(12,2),
      "Descatalogacion" TEXT,
      "Perdida_Descatalogacion" NUMERIC(12,2),
      "Varacion_PVP_S_1" NUMERIC(12,2),
      "Sobre_Venta_S_1" NUMERIC(12,2),
      "Stock_Semana_1" NUMERIC(12,2),
      "Sobre_Venta_S_2" NUMERIC(12,2),
      "Perdida_Sobre_Venta" NUMERIC(12,2),
      "Venta_Perdida_Sin_Obs" NUMERIC(12,2),
      "Perdida_Valorizada" NUMERIC(12,2),
      "Perdida_Stock_Valorizada" NUMERIC(12,2),
      "Perdida_Sobreventa_Valorizada" NUMERIC(12,2),
      "Perdida_Fill_Rate_Valorizada" NUMERIC(12,2),
      "Perdida_Descatalogo_Valorizada" NUMERIC(12,2),
      
      -- Metadatos
      "created_at" TIMESTAMPTZ DEFAULT NOW(),
      "updated_at" TIMESTAMPTZ DEFAULT NOW(),
      
      -- Índice único para evitar duplicados
      UNIQUE("Semana", "Cuenta", "Sku_Seller")
    );
  `;

  try {
    // Usar la función rpc para ejecutar SQL raw
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (error) {
      // Si no existe la función exec_sql, intentamos crear la tabla de otra forma
      console.log(colors.yellow + '⚠️  No se puede ejecutar SQL directo. Verificando si la tabla existe...' + colors.reset);
      
      // Intentar insertar un registro de prueba para ver si la tabla existe
      const { error: testError } = await supabase
        .from('Plan_Demanda')
        .select('id')
        .limit(1);
      
      if (testError && testError.code === '42P01') {
        console.log(colors.red + '\n❌ La tabla no existe y no se puede crear automáticamente.' + colors.reset);
        console.log(colors.cyan + '\n📋 Por favor, ejecuta el siguiente SQL en el Editor SQL de Supabase:' + colors.reset);
        console.log(colors.yellow + '\n' + createTableSQL + colors.reset);
        console.log(colors.cyan + '\n🔗 Ve a: https://supabase.com/dashboard/project/mjvljlaljgzascfpogtr/sql/new' + colors.reset);
        return false;
      } else {
        console.log(colors.green + '✅ La tabla Plan_Demanda ya existe!' + colors.reset);
        return true;
      }
    }
    
    console.log(colors.green + '✅ Tabla Plan_Demanda creada exitosamente!' + colors.reset);
    return true;
  } catch (err) {
    console.log(colors.red + `❌ Error: ${err.message}` + colors.reset);
    return false;
  }
}

createTable().catch(console.error);

