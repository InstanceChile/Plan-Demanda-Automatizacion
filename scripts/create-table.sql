-- =====================================================
-- Script para crear la tabla Plan_Demanda en Supabase
-- Ejecutar en: https://supabase.com/dashboard/project/mjvljlaljgzascfpogtr/sql/new
-- =====================================================

-- Eliminar tabla si existe (CUIDADO: esto borra todos los datos)
-- DROP TABLE IF EXISTS "Plan_Demanda";

-- Crear la tabla Plan_Demanda
CREATE TABLE IF NOT EXISTS "Plan_Demanda" (
  -- ID autoincremental
  id BIGSERIAL PRIMARY KEY,
  
  -- =====================================================
  -- DATOS INICIALES (carga manual/CSV)
  -- =====================================================
  "Semana" INTEGER NOT NULL,                    -- Formato: YYYYWW (ej: 202549)
  "Nodo" TEXT,                                   -- Nodo de distribución
  "Cuenta" TEXT NOT NULL,                        -- Cliente/Cuenta
  "Sku_Seller" TEXT NOT NULL,                    -- SKU del vendedor
  "Pronostico" NUMERIC(12,2),                    -- Pronóstico inicial
  "Plan_demanda" NUMERIC(12,2),                  -- Plan de demanda ajustado
  "PVP_PD" NUMERIC(12,2),                        -- Precio de venta planificado
  "Accion" TEXT,                                 -- Acción a tomar
  "Observaciones" TEXT,                          -- Observaciones generales
  
  -- =====================================================
  -- PRIMERA ACTUALIZACIÓN (desde MySQL - ventas reales)
  -- =====================================================
  "Venta_Real" NUMERIC(12,2),                    -- Venta real de la semana
  "PVP_Prom" NUMERIC(12,2),                      -- Precio promedio real
  "Error" NUMERIC(12,4),                         -- Error del pronóstico (puede ser negativo)
  "Error_Abs" NUMERIC(12,4),                     -- Error absoluto
  "Dips" NUMERIC(12,2),                          -- Disponibilidad
  
  -- =====================================================
  -- CAMPOS ADICIONALES DE ANÁLISIS
  -- =====================================================
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
  
  -- =====================================================
  -- METADATOS
  -- =====================================================
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  
  -- Índice único para evitar duplicados por semana/cuenta/sku
  UNIQUE("Semana", "Cuenta", "Sku_Seller")
);

-- Crear índices para mejorar performance de búsquedas
CREATE INDEX IF NOT EXISTS idx_plan_demanda_semana ON "Plan_Demanda"("Semana");
CREATE INDEX IF NOT EXISTS idx_plan_demanda_cuenta ON "Plan_Demanda"("Cuenta");
CREATE INDEX IF NOT EXISTS idx_plan_demanda_sku ON "Plan_Demanda"("Sku_Seller");

-- Habilitar Row Level Security (RLS)
ALTER TABLE "Plan_Demanda" ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones (ajustar según necesidades de seguridad)
CREATE POLICY "Allow all operations" ON "Plan_Demanda"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentarios en la tabla
COMMENT ON TABLE "Plan_Demanda" IS 'Tabla principal para el plan de demanda semanal y seguimiento de ventas reales';
COMMENT ON COLUMN "Plan_Demanda"."Semana" IS 'Semana en formato YYYYWW (ej: 202549 = semana 49 de 2025)';
COMMENT ON COLUMN "Plan_Demanda"."Error" IS 'Error = (Venta_Real - Plan_demanda) / Plan_demanda';
COMMENT ON COLUMN "Plan_Demanda"."Error_Abs" IS 'Valor absoluto del error';

