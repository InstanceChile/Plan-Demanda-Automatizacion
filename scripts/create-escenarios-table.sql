-- ============================================
-- ESCENARIOS POR PUBLICACIÓN
-- Contiene la cantidad y precio para cada escenario
-- por cada SKU/Nodo/Cuenta
-- ============================================

CREATE TABLE IF NOT EXISTS public.escenarios_plan_demanda (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificadores de la publicación
    "Nodo" TEXT NOT NULL,
    "Cuenta" TEXT NOT NULL,
    "Sku_Seller" TEXT NOT NULL,
    
    -- Escenario: 'Venta', 'Sobreprecio_5', 'Sobreprecio_10', 
    --            'Descuento_5', 'Descuento_10', 'Super_Descuento'
    "Escenario" TEXT NOT NULL,
    
    -- Valores del escenario
    "Cantidad_Venta" NUMERIC(12,2) NOT NULL,  -- Unidades proyectadas
    "Precio_Venta" NUMERIC(12,2) NOT NULL,     -- Precio en este escenario
    
    -- Metadatos
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    
    -- Restricción única: un registro por SKU/Nodo/Cuenta/Escenario
    CONSTRAINT escenarios_unique_key UNIQUE ("Nodo", "Cuenta", "Sku_Seller", "Escenario")
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_escenarios_sku ON public.escenarios_plan_demanda("Sku_Seller");
CREATE INDEX IF NOT EXISTS idx_escenarios_nodo_cuenta ON public.escenarios_plan_demanda("Nodo", "Cuenta");
CREATE INDEX IF NOT EXISTS idx_escenarios_escenario ON public.escenarios_plan_demanda("Escenario");

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_escenarios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escenarios_updated_at_trigger ON public.escenarios_plan_demanda;
CREATE TRIGGER escenarios_updated_at_trigger
    BEFORE UPDATE ON public.escenarios_plan_demanda
    FOR EACH ROW
    EXECUTE FUNCTION update_escenarios_updated_at();

-- Comentario
COMMENT ON TABLE public.escenarios_plan_demanda IS 'Almacena cantidad y precio por escenario para cada publicación';

-- ============================================
-- HISTORIAL DE CAMBIOS EN PLAN_DEMANDA
-- Registra quién, cuándo y qué cambió
-- ============================================

CREATE TABLE IF NOT EXISTS public.historial_cambios_plan (
    id BIGSERIAL PRIMARY KEY,
    
    -- Identificadores del registro modificado en Plan_Demanda
    "Nodo" TEXT NOT NULL,
    "Cuenta" TEXT NOT NULL,
    "Sku_Seller" TEXT NOT NULL,
    "Semana" INTEGER NOT NULL,
    
    -- Qué campo se modificó
    "Campo_Modificado" TEXT NOT NULL, -- 'Plan_demanda', 'PVP_PD', 'Accion', 'multiple'
    
    -- Valores antes y después
    "Valor_Anterior" TEXT,
    "Valor_Nuevo" TEXT,
    
    -- Si se modificaron múltiples campos, guardar detalle en JSON
    "Cambios_Detalle" JSONB,
    
    -- Escenario que se aplicó (o 'Carga_Manual' si fue ingreso manual)
    "Escenario_Aplicado" TEXT NOT NULL,
    
    -- Auditoría
    "Usuario" TEXT NOT NULL,
    "IP_Address" TEXT,
    "User_Agent" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_historial_semana ON public.historial_cambios_plan("Semana");
CREATE INDEX IF NOT EXISTS idx_historial_sku ON public.historial_cambios_plan("Sku_Seller");
CREATE INDEX IF NOT EXISTS idx_historial_usuario ON public.historial_cambios_plan("Usuario");
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON public.historial_cambios_plan("created_at" DESC);
CREATE INDEX IF NOT EXISTS idx_historial_nodo_cuenta ON public.historial_cambios_plan("Nodo", "Cuenta");

-- Comentario
COMMENT ON TABLE public.historial_cambios_plan IS 'Auditoría de cambios realizados en Plan_Demanda';

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================

ALTER TABLE public.escenarios_plan_demanda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_cambios_plan ENABLE ROW LEVEL SECURITY;

-- Acceso completo para service_role
CREATE POLICY "Service role full access escenarios" ON public.escenarios_plan_demanda
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access historial" ON public.historial_cambios_plan
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- FUNCIÓN: Obtener valores de escenario para un SKU
-- ============================================

CREATE OR REPLACE FUNCTION public.fn_obtener_escenario(
    p_nodo TEXT,
    p_cuenta TEXT,
    p_sku TEXT,
    p_escenario TEXT
)
RETURNS TABLE (
    cantidad_venta NUMERIC(12,2),
    precio_venta NUMERIC(12,2)
)
LANGUAGE sql
STABLE
AS $$
    SELECT "Cantidad_Venta", "Precio_Venta"
    FROM public.escenarios_plan_demanda
    WHERE "Nodo" = p_nodo
      AND "Cuenta" = p_cuenta
      AND "Sku_Seller" = p_sku
      AND "Escenario" = p_escenario
    LIMIT 1;
$$;

-- ============================================
-- FUNCIÓN: Obtener todos los escenarios de un SKU
-- ============================================

CREATE OR REPLACE FUNCTION public.fn_obtener_escenarios_sku(
    p_nodo TEXT,
    p_cuenta TEXT,
    p_sku TEXT
)
RETURNS TABLE (
    escenario TEXT,
    cantidad_venta NUMERIC(12,2),
    precio_venta NUMERIC(12,2)
)
LANGUAGE sql
STABLE
AS $$
    SELECT "Escenario", "Cantidad_Venta", "Precio_Venta"
    FROM public.escenarios_plan_demanda
    WHERE "Nodo" = p_nodo
      AND "Cuenta" = p_cuenta
      AND "Sku_Seller" = p_sku
    ORDER BY 
        CASE "Escenario"
            WHEN 'Venta' THEN 1
            WHEN 'Sobreprecio_5' THEN 2
            WHEN 'Sobreprecio_10' THEN 3
            WHEN 'Descuento_5' THEN 4
            WHEN 'Descuento_10' THEN 5
            WHEN 'Super_Descuento' THEN 6
        END;
$$;

-- ============================================
-- VISTA: Últimos cambios por publicación/semana
-- ============================================

CREATE OR REPLACE VIEW public.v_ultimos_cambios_plan AS
SELECT DISTINCT ON ("Nodo", "Cuenta", "Sku_Seller", "Semana")
    "Nodo",
    "Cuenta", 
    "Sku_Seller",
    "Semana",
    "Escenario_Aplicado",
    "Usuario",
    "created_at" AS "Fecha_Ultimo_Cambio"
FROM public.historial_cambios_plan
ORDER BY "Nodo", "Cuenta", "Sku_Seller", "Semana", "created_at" DESC;

COMMENT ON VIEW public.v_ultimos_cambios_plan IS 'Muestra el último cambio realizado por cada publicación/semana';

-- ============================================
-- EJEMPLO DE DATOS (opcional, para pruebas)
-- ============================================

-- INSERT INTO public.escenarios_plan_demanda 
--     ("Nodo", "Cuenta", "Sku_Seller", "Escenario", "Cantidad_Venta", "Precio_Venta")
-- VALUES 
--     ('Mercadolibre_Chile', 'Beiersdorf', 'SKU-001', 'Venta', 100, 9990),
--     ('Mercadolibre_Chile', 'Beiersdorf', 'SKU-001', 'Sobreprecio_5', 95, 10490),
--     ('Mercadolibre_Chile', 'Beiersdorf', 'SKU-001', 'Sobreprecio_10', 90, 10990),
--     ('Mercadolibre_Chile', 'Beiersdorf', 'SKU-001', 'Descuento_5', 105, 9490),
--     ('Mercadolibre_Chile', 'Beiersdorf', 'SKU-001', 'Descuento_10', 110, 8990),
--     ('Mercadolibre_Chile', 'Beiersdorf', 'SKU-001', 'Super_Descuento', 120, 7990);
