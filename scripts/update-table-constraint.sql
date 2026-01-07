-- =====================================================
-- Script para actualizar la restricción única de Plan_Demanda
-- Ejecutar en: https://supabase.com/dashboard/project/mjvljlaljgzascfpogtr/sql/new
-- =====================================================

-- Paso 1: Eliminar la restricción única anterior
ALTER TABLE "Plan_Demanda" 
DROP CONSTRAINT IF EXISTS "Plan_Demanda_Semana_Cuenta_Sku_Seller_key";

-- Paso 2: Crear la nueva restricción única incluyendo Nodo
ALTER TABLE "Plan_Demanda" 
ADD CONSTRAINT "Plan_Demanda_Semana_Nodo_Cuenta_Sku_Seller_key" 
UNIQUE ("Semana", "Nodo", "Cuenta", "Sku_Seller");

-- Paso 3: Crear índice para el Nodo
CREATE INDEX IF NOT EXISTS idx_plan_demanda_nodo ON "Plan_Demanda"("Nodo");

-- Verificar la nueva restricción
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = '"Plan_Demanda"'::regclass;

