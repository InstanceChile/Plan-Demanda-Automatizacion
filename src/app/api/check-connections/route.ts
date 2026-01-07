import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const status = {
    supabase: false,
    mysql: false
  };

  // Verificar Supabase
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error } = await supabase.from('Plan_Demanda').select('count').limit(1);
      
      // Si no hay error o el error es que la tabla no existe, la conexión funciona
      status.supabase = !error || error.code === '42P01' || error.code === 'PGRST116';
    }
  } catch (error) {
    console.error('Error checking Supabase:', error);
  }

  // Por ahora MySQL está deshabilitado hasta resolver el acceso VPN
  // TODO: Implementar verificación de MySQL cuando esté disponible
  status.mysql = false;

  return NextResponse.json(status);
}

