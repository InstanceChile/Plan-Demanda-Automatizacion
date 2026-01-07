import { createClient } from '@supabase/supabase-js';

// Tipos para la tabla Plan_Demanda
export interface PlanDemanda {
  id?: number;
  Semana: number;
  Nodo?: string;
  Cuenta: string;
  Sku_Seller: string;
  Pronostico?: number;
  Plan_demanda?: number;
  PVP_PD?: number;
  Accion?: string;
  Observaciones?: string;
  Venta_Real?: number;
  PVP_Prom?: number;
  Error?: number;
  Error_Abs?: number;
  Dips?: number;
  Stock_Inicio_Semana?: number;
  Venta_Perdida_Stock?: number;
  Fill_Rate?: number;
  Fecha_Ultima_Oc?: string;
  Perdida_Fill_Rate?: number;
  Descatalogacion?: string;
  Perdida_Descatalogacion?: number;
  Varacion_PVP_S_1?: number;
  Sobre_Venta_S_1?: number;
  Stock_Semana_1?: number;
  Sobre_Venta_S_2?: number;
  Perdida_Sobre_Venta?: number;
  Venta_Perdida_Sin_Obs?: number;
  Perdida_Valorizada?: number;
  Perdida_Stock_Valorizada?: number;
  Perdida_Sobreventa_Valorizada?: number;
  Perdida_Fill_Rate_Valorizada?: number;
  Perdida_Descatalogo_Valorizada?: number;
  created_at?: string;
  updated_at?: string;
}

// Cliente de Supabase para el servidor
export function getSupabaseServer() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan credenciales de Supabase');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Cliente de Supabase para el cliente (browser)
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltan credenciales de Supabase');
  }

  return createClient(supabaseUrl, supabaseKey);
}

