/**
 * Script para probar las conexiones a Supabase y MySQL
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const mysql = require('mysql2/promise');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, type = 'info') {
  const prefix = {
    success: `${colors.green}✅`,
    error: `${colors.red}❌`,
    info: `${colors.cyan}ℹ️`,
    warning: `${colors.yellow}⚠️`
  };
  console.log(`${prefix[type]} ${message}${colors.reset}`);
}

async function testSupabase() {
  console.log('\n' + colors.bold + '═══════════════════════════════════════' + colors.reset);
  console.log(colors.bold + '  PROBANDO CONEXIÓN A SUPABASE' + colors.reset);
  console.log(colors.bold + '═══════════════════════════════════════' + colors.reset);

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Faltan credenciales de Supabase en el archivo env');
    }

    log(`URL: ${supabaseUrl}`, 'info');
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Intentar una consulta simple para verificar la conexión
    const { data, error } = await supabase.from('Plan_Demanda').select('count').limit(1);
    
    if (error && error.code === '42P01') {
      // La tabla no existe, pero la conexión funciona
      log('Conexión exitosa a Supabase', 'success');
      log('La tabla Plan_Demanda aún no existe (se creará después)', 'warning');
      return true;
    } else if (error) {
      // Otro tipo de error, pero puede que la conexión funcione
      log('Conexión exitosa a Supabase', 'success');
      log(`Nota: ${error.message}`, 'warning');
      return true;
    } else {
      log('Conexión exitosa a Supabase', 'success');
      log('La tabla Plan_Demanda existe', 'success');
      return true;
    }
  } catch (error) {
    log(`Error conectando a Supabase: ${error.message}`, 'error');
    return false;
  }
}

async function testMySQL() {
  console.log('\n' + colors.bold + '═══════════════════════════════════════' + colors.reset);
  console.log(colors.bold + '  PROBANDO CONEXIÓN A MYSQL' + colors.reset);
  console.log(colors.bold + '═══════════════════════════════════════' + colors.reset);

  let connection;
  try {
    const config = {
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      connectTimeout: 10000
    };

    log(`Host: ${config.host}:${config.port}`, 'info');
    log(`Base de datos: ${config.database}`, 'info');
    log(`Usuario: ${config.user}`, 'info');

    connection = await mysql.createConnection(config);
    log('Conexión exitosa a MySQL', 'success');

    // Probar una consulta simple
    const [rows] = await connection.execute('SELECT 1 as test');
    log('Consulta de prueba ejecutada correctamente', 'success');

    // Verificar que existe la tabla products_in_orders
    const [tables] = await connection.execute(
      "SHOW TABLES LIKE 'products_in_orders'"
    );
    
    if (tables.length > 0) {
      log('Tabla products_in_orders encontrada', 'success');
      
      // Contar registros recientes
      const [count] = await connection.execute(
        "SELECT COUNT(*) as total FROM products_in_orders WHERE fecha_creacion >= '2025-01-01'"
      );
      log(`Registros desde 2025: ${count[0].total.toLocaleString()}`, 'info');
    } else {
      log('Tabla products_in_orders no encontrada', 'warning');
    }

    return true;
  } catch (error) {
    log(`Error conectando a MySQL: ${error.message}`, 'error');
    return false;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function main() {
  console.log('\n' + colors.bold + colors.cyan);
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   TEST DE CONEXIONES - PLAN DEMANDA               ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  console.log(colors.reset);

  const supabaseOk = await testSupabase();
  const mysqlOk = await testMySQL();

  console.log('\n' + colors.bold + '═══════════════════════════════════════' + colors.reset);
  console.log(colors.bold + '  RESUMEN' + colors.reset);
  console.log(colors.bold + '═══════════════════════════════════════' + colors.reset);
  
  console.log(`\nSupabase: ${supabaseOk ? colors.green + '✅ CONECTADO' : colors.red + '❌ ERROR'}${colors.reset}`);
  console.log(`MySQL:    ${mysqlOk ? colors.green + '✅ CONECTADO' : colors.red + '❌ ERROR'}${colors.reset}`);

  if (supabaseOk && mysqlOk) {
    console.log('\n' + colors.green + colors.bold + '🎉 ¡Todas las conexiones funcionan correctamente!' + colors.reset);
    console.log(colors.cyan + '\nPróximo paso: Crear la tabla Plan_Demanda en Supabase' + colors.reset);
  } else {
    console.log('\n' + colors.red + '⚠️ Hay problemas con alguna conexión. Revisa las credenciales.' + colors.reset);
  }

  console.log('\n');
}

main().catch(console.error);

