# Changelog - Plan Demanda Automatización

## [0.7.0] - 2026-01-02

### Cambio de Paleta de Colores - Tema Claro Estilo Instance

#### Nueva Paleta de Colores
- **Fondo principal**: `#f5f7fa` (gris muy claro)
- **Fondo secundario/cards**: `#ffffff` (blanco)
- **Texto primario**: `#0d2b4a` (azul navy oscuro)
- **Texto secundario**: `#4a5568` (gris oscuro)
- **Texto muted**: `#718096` (gris medio)
- **Acento primario**: `#00b8a9` (turquesa/cyan)
- **Acento secundario**: `#1e3a5f` (azul navy)
- **Bordes**: `#e2e8f0` (gris suave)

#### Componentes Actualizados
- **Login**: Fondo claro con card blanca
- **Sidebar**: Fondo blanco con iconos azul oscuro
- **Cards y paneles**: Fondo blanco con sombras suaves
- **Botones primarios**: Turquesa con texto blanco
- **Botones secundarios**: Azul navy con texto blanco
- **Tablas**: Fondos claros con hover turquesa sutil
- **Scrollbars**: Gradiente turquesa → azul navy
- **Celdas editables**: Borde turquesa punteado

#### Sombras Ajustadas
- Sombras más sutiles para tema claro
- `--shadow-sm`: `0 2px 8px rgba(0, 0, 0, 0.06)`
- `--shadow-md`: `0 4px 20px rgba(0, 0, 0, 0.08)`
- `--shadow-lg`: `0 8px 40px rgba(0, 0, 0, 0.12)`

#### Gráfico Actualizado
- **Línea Venta Real**: Azul navy oscuro (`#0d2b4a`) - antes era blanco
- **Línea Tendencia**: Azul (`#3b82f6`) - con línea punteada
- **Puntos Proyección**: Turquesa (`#00b8a9`)
- **Fondo gráfico**: Gris muy claro (`#f8fafc`)
- **Grid lines**: Gris suave para visibilidad
- **Etiquetas**: Gris medio (`#718096`)

#### Columnas Fijas en Tabla (Scroll Interno)
- **Checkbox, Código y Nombre permanecen fijos** al hacer scroll horizontal
- **Scroll contenido dentro de la tabla**, no en la página completa
- Estructura flex mejorada: header de filtros fijo, tabla con scroll independiente
- Sombra en la columna "Nombre" para indicar separación visual
- Z-index optimizado para headers y celdas sticky

#### Corrección de Error en Escenarios
- Corregido TypeError "Cannot create property '8' on string 'Venta'"
- Estructura de datos `escenarioSeleccionado` migrada correctamente a `Record<string, Record<number, string>>`
- Validación adicional para manejar datos de estructura vieja (string vs objeto)

#### Consistencia con Plataforma Instance
- Paleta alineada con imagen de referencia de la plataforma
- Preparado para integración con otros módulos de Instance

---

## [0.6.13] - 2025-12-30

### Optimización de Tamaños para Vista Completa en Pantalla

#### Layout General
- Contenedor principal: `height: calc(100vh - 16px)` con `overflow: hidden`
- Gap reducido a 8px entre elementos
- Border-radius reducido a 16px para más espacio

#### Panel Lateral (Detalle Publicación)
- Ancho mantenido: 320px
- Padding reducido: 8px
- Gap entre secciones: 8px
- Títulos: 10px, valores: 11px

#### Tabla Principal
- Header: padding 6px, font-size 10px
- Celdas: padding 4px 6px, font-size 11px
- Min-width reducido a 700px

#### Controles y Filtros
- Altura inputs/selects: 28px
- Font-size: 11px
- Padding header: 8px
- Simbar padding: 6px

#### Gráfico
- Tamaño: 300x110px (antes 320x140px)
- Padding interno: 14px

---

## [0.6.12] - 2025-12-30

### Detalle de Publicación con Stock y Último Escenario

#### Nuevo Endpoint `/api/plan-demanda/detalle`
- Usa función SQL `f_plan_demanda_detalle(p_semana, p_nodo, p_cuenta, p_sku)`
- Parámetros requeridos: `nodo`, `cuenta`, `sku_seller`, `semana`
- Retorna: Stock, Disponibilidad (Dips), Accion, Plan_demanda, Venta_Real

#### Panel Lateral Reorganizado
Nuevo orden de secciones:
1. **Características del producto**: SKU, Cliente, Semana, Marketplace
2. **Escenario para semana**: Selector y valores del escenario
3. **Gráfico**: Ventas real + tendencia + proyección
4. **Detalle Semana**: Stock, Disponibilidad, Último Escenario guardado

#### Datos del Detalle Semana
- **Stock Inicio Semana**: Valor de `Stock_Inicio_Semana`
- **Disponibilidad**: Valor de `Dips`
- **Último Escenario**: Campo `Accion` guardado en la tabla
- **Plan Demanda**: Valor registrado
- **Venta Real**: Venta real de la semana
- **Última Actualización**: Fecha/hora del último cambio

#### Carga Automática por Semana
- Se carga el detalle al seleccionar una celda (publicación + semana)
- Indicador de carga mientras consulta
- Se actualiza al cambiar de semana o publicación

---

## [0.6.11] - 2025-12-29

### Corrección: Escenarios Independientes por Semana

#### Estructura de Datos Modificada
- **`escenarioSeleccionado`** ahora es `Record<string, Record<number, string>>`
- Cada SKU puede tener un escenario DIFERENTE para cada semana (S+2, S+3, S+4)
- Estructura: `{ "sku_key": { 7: "Venta", 8: "Descuento_5", 9: "Manual" } }`

#### Nueva Función `getEscenarioSemana`
- Obtiene el escenario específico para un SKU + semana
- El dropdown del panel lateral muestra el escenario de la semana seleccionada
- El input manual solo aparece si ESA semana tiene escenario "Manual"

#### Flujo Corregido
1. Click en celda S+2 → Seleccionar "Descuento_5" → Solo S+2 cambia
2. Click en celda S+3 → Seleccionar "Venta" → Solo S+3 cambia  
3. Click en celda S+4 → Seleccionar "Manual" → Ingresar valor → Solo S+4 cambia
4. Cada semana mantiene su escenario independiente

#### Guardado Mejorado
- `saveChanges` genera un registro por cada semana modificada
- Cada registro incluye el escenario específico de esa semana
- Soporta mezcla de escenarios y valores manuales

---

## [0.6.10] - 2025-12-29

### Mejora UX: Filtros Sticky y Scrollbar Visible

#### Filtros Fijos (Sticky)
- **Los filtros permanecen visibles** mientras haces scroll en la tabla
- Header con efecto blur para mantener legibilidad
- Incluye: buscador, filtros de Marketplace, Cliente, Portafolio, Segmentación
- También se mantiene visible la barra de simulación de escenarios

#### Scrollbar Mejorada
- **Barra de desplazamiento más grande** (14px de ancho/alto)
- Gradiente de colores azul → rosa para mayor visibilidad
- Track semi-transparente para contexto
- Hover con efecto de intensificación del color
- Compatible con Chrome/Edge (webkit) y Firefox

---

## [0.6.9] - 2025-12-29

### Corrección: Escenario se Aplica Solo a Semana Seleccionada

#### Comportamiento Corregido
- **Click en celda + seleccionar escenario** → Solo afecta ESA semana
- **Sin celda seleccionada + escenario** → Afecta todas las semanas marcadas en checkboxes
- Título del panel lateral muestra la semana que se está modificando

#### Nueva Función `cambiarEscenarioSemana`
- Aplica escenario a una semana específica sin afectar las demás
- Se usa automáticamente cuando hay una celda seleccionada
- Permite trabajar semana por semana de forma rápida

#### Flujo de Trabajo
1. Click en celda de S+2 → Panel muestra "Escenario para semana 202603"
2. Seleccionar escenario → Solo S+2 cambia
3. Click en celda de S+4 → Panel muestra "Escenario para semana 202605"
4. Seleccionar otro escenario → Solo S+4 cambia
5. S+2 mantiene su escenario anterior

---

## [0.6.8] - 2025-12-29

### Corrección: Valores Manuales Independientes por Semana

#### Valores por Semana
- **Cada semana es independiente** - Un valor manual en S+2 no afecta S+3 o S+4
- Los valores manuales se guardan por SKU + semana específica
- Cambiar de escenario solo afecta las semanas seleccionadas, no las que ya tienen valor manual

#### Prioridad de Valores
1. **Valor manual** para esa semana específica (si existe)
2. **Escenario aplicado** (si tiene escenario y no es Manual)
3. **Plan_Demanda** (valor original de la tabla)

#### Flujo Mejorado
- Puedes mezclar escenarios y valores manuales en diferentes semanas del mismo SKU
- Ejemplo: S+2 con escenario "Descuento_5", S+3 con valor manual "15", S+4 con escenario "Venta"

---

## [0.6.7] - 2025-12-29

### Selección Automática y Entrada Manual

#### Activación Automática de Semanas
- **Click en celda activa la semana** - Al hacer clic en una celda editable (S+2, S+3, S+4), automáticamente se marca para modificar
- El SKU se agrega a los cambios pendientes
- Flujo más rápido: click → seleccionar escenario → guardar

#### Opción "Manual"
- **Nuevo escenario "Manual"** en el dropdown
- Permite ingresar un valor numérico directamente
- Input numérico en el panel lateral cuando se selecciona Manual
- Solo acepta números positivos

#### Indicadores Visuales
- **📊** = Valor de escenario aplicado (borde rosa)
- **✏️** = Valor manual ingresado (borde azul)
- Celdas manuales con fondo azul tenue

---

## [0.6.6] - 2025-12-29

### Mejoras de Filtros y UI

#### Nuevos Filtros
- **Filtro de Portafolio** - Filtra por el campo Portafolio del PIM
- **Filtro de Segmentación** - Filtra por SegmentacionDe_Portafolio
- Ambos filtros se cargan automáticamente de los datos de Supabase

#### Corrección de Combobox
- **Opciones con texto negro** - Las opciones del dropdown ahora son legibles
- Fondo blanco con texto negro para mejor contraste

---

## [0.6.5] - 2025-12-29

### Lógica de Escenarios Mejorada

#### Comportamiento por Defecto
- **Plan_Demanda como valor inicial** - Todas las celdas muestran los valores originales de la tabla Plan_Demanda
- **Escenarios solo al aplicar** - Los valores de escenarios solo se usan cuando el usuario los aplica explícitamente
- **Botón para quitar escenario** (✕) permite volver a mostrar Plan_Demanda

#### Semanas Modificables
- **S0 y S+1 son solo lectura** - Semana actual y siguiente no se pueden modificar
- **S+2, S+3 y S+4 son editables** - Marcadas con asterisco (*) en el header
- **3 checkboxes independientes** para seleccionar qué semanas modificar
- Indicadores visuales: headers rosa (editables) vs gris (solo lectura)

#### Tracking por SKU y Semana
- Cada SKU guarda qué semanas tienen escenario aplicado
- El icono 📊 aparece solo en las celdas con escenario activo
- Estado "Modificado" indica SKUs con cambios pendientes

---

## [0.6.4] - 2025-12-29

### Mejoras de Proyección y UI

#### Semana Actual en Proyección
- **Agregada columna Semana_PD_0** (semana actual/referencia, ej: 202601)
- Ahora muestra 5 semanas de proyección: S0, S+1, S+2*, S+3*, S+4*
- Las semanas con asterisco (*) son las modificables

#### Sidebar Colapsable
- **Botón de colapsar/expandir** en el sidebar
- El sidebar se oculta completamente dando más espacio a la tabla
- Botón flotante visible cuando está colapsado para reabrir
- Transición suave con animación

#### UI Mejorada
- Headers de semanas editables resaltados en rosa
- Celdas de semanas editables con borde punteado
- Checkboxes estilizados para selección de semanas
- Gráfico actualizado con 10 puntos (5 históricos + 5 proyección)

---

## [0.6.3] - 2025-12-29

### Mejoras de UI - Logo y Semanas

#### Logo Instance
- **Logo en sidebar** - Reemplazado texto "Plan Demanda" por logo de Instance
- **SVG logo** en `/public/logo-instance.svg` (personalizable)
- **Estilos actualizados** para el nuevo logo

#### Semanas Reales en Cabeceras
- **Números de semana reales** en lugar de W-5, W-4, etc.
- Ahora muestra: 202548, 202549, 202550, etc.
- Aplica a:
  - Headers de la tabla principal
  - Etiquetas del gráfico
  - Exportación CSV
  - Panel lateral de detalle

---

## [0.6.2] - 2025-12-29

### Módulo Plan Demanda - Conexión con Tabla de Escenarios

#### Integración Completa
- **Lectura de escenarios** desde tabla `escenarios_plan_demanda`
- **Selector de escenario por SKU** en la tabla principal
- **Aplicación masiva** de escenarios a todas o solo seleccionadas
- **Indicador visual** de SKUs con escenarios cargados vs sin escenarios
- **Marcado de cambios pendientes** antes de guardar

#### Gráfico de Ventas
- **Gráfico SVG** en panel lateral (como en maqueta original)
- **3 series**: Venta Real (blanco), Tendencia (azul), Proyección (rosa)
- **Regresión lineal** para calcular tendencia
- **Leyenda visual** con puntos de colores

#### Guardado en Plan_Demanda
- Al guardar, actualiza `Plan_demanda`, `PVP_PD` y `Accion`
- Registra en `historial_cambios_plan` con auditoría completa
- Muestra contador de cambios pendientes

#### UI Mejorada
- Celdas W+3/W+4 resaltadas cuando usan escenario
- Tag "Modificado" en filas con cambios pendientes
- Tag "Sin escenarios" para SKUs sin datos de escenario
- Selector de escenario inline por cada fila

---

## [0.6.1] - 2025-12-29

### Importación de Escenarios desde CSV

#### Nuevo: Tabla `escenarios_plan_demanda`
- Almacena **cantidad y precio por escenario** para cada SKU/Nodo/Cuenta
- Escenarios disponibles: Venta, Sobreprecio_5, Sobreprecio_10, Descuento_5, Descuento_10, Super_Descuento
- Clave única: Nodo + Cuenta + Sku_Seller + Escenario

#### Nuevo: API `/api/upload-escenarios-csv`
- Importa escenarios desde archivo CSV
- Valida columnas requeridas: Nodo, Cuenta, Sku_Seller, Escenario, Cantidad_Venta, Precio_Venta
- Soporta separadores coma y punto y coma
- Upsert automático (inserta o actualiza)

#### Nuevo: Botón en Análisis Semanal
- **Cargar Escenarios** - Nueva tarjeta para importar CSV de escenarios
- Muestra las columnas requeridas como ayuda
- Feedback de resultados en modal y log

#### Archivos Nuevos
- `src/app/api/upload-escenarios-csv/route.ts` - API de importación
- Script SQL actualizado con estructura correcta

---

## [0.6.0] - 2025-12-29

### Módulo Plan Demanda - Proyección por Publicación

#### Nuevo: Interfaz de Proyección
- **Tabla de proyecciones** basada en maqueta v11
- **5 semanas históricas** (W-5 a W-1) + **4 semanas de proyección** (W+1 a W+4)
- **Visualización con heat map** según nivel de ventas
- **Selección múltiple** de publicaciones con checkbox
- **Sumatorias dinámicas** de proyección por semana

#### Nuevo: Sistema de Escenarios
- **6 escenarios disponibles**:
  - Venta (base)
  - Sobreprecio 5%
  - Sobreprecio 10%
  - Descuento 5%
  - Descuento 10%
  - Súper Descuento (-20%)
- **Aplicar a W+3, W+4 o ambos**
- **Aplicar a todas o solo seleccionadas**
- **Cálculo de elasticidad** automático según ventas históricas

#### Nuevo: Panel Lateral
- **Detalle de publicación** seleccionada
- **KPIs**: SKU, Cliente, Marketplace, Portafolio, Segmentación
- **Precios PVP** por semana
- **Escenarios individuales** editables por publicación

#### Nuevo: API `/api/plan-demanda`
- **GET**: Llama a `fn_reporte_plan(ref_semana)` en Supabase
- **POST**: Guarda escenarios con auditoría completa
- **Filtros**: Por Nodo (Marketplace) y Cuenta (Cliente)

#### Nuevo: Tablas de Base de Datos
- **`escenarios_plan_demanda`**: Almacena escenarios editados
  - Escenario W+3 y W+4
  - Proyecciones manuales (override)
  - Precios por semana
  - Estado pendiente de eliminación
  - Auditoría: Creado_Por, Modificado_Por, timestamps
- **`historial_cambios_plan`**: Registro de todos los cambios
  - Acción (CREATE, UPDATE, DELETE)
  - Valores anteriores y nuevos (JSON)
  - Usuario, IP, User-Agent

#### Archivos Nuevos
- `src/app/api/plan-demanda/route.ts` - API de proyecciones
- `src/app/modulos/plan-demanda/page.tsx` - Página del módulo (actualizada)
- `scripts/create-escenarios-table.sql` - Script SQL para tablas

#### Estilos Nuevos
- Estilos específicos para tabla de proyecciones (`.pd-*`)
- Heat map visual para celdas de venta
- Panel lateral sticky con scroll independiente

---

## [0.5.0] - 2025-12-29

### Sistema Modular con Autenticación

#### Nuevo: Sistema de Login
- **Página de login** con diseño moderno y animaciones
- **Credenciales**: Usuario `Admin` / Contraseña `Instance.01`
- **Persistencia de sesión** usando localStorage
- **Protección de rutas**: Todos los módulos requieren autenticación

#### Nuevo: Barra Lateral de Navegación
- **Sidebar fijo** a la izquierda con navegación entre módulos
- **Información del usuario** con botón de cerrar sesión
- **Diseño responsive** que se adapta a pantallas móviles
- **Indicador visual** del módulo activo

#### Nuevo: Estructura Modular
- **Módulo Análisis Semanal** (`/modulos/analisis-semanal`)
  - Contiene toda la funcionalidad previa del panel principal
  - Carga de plan de demanda, ventas, stock y reportes
- **Módulo Plan Demanda** (`/modulos/plan-demanda`)
  - Estructura base preparada para nuevas funcionalidades
  - Placeholder con lista de funcionalidades planificadas

#### Archivos Nuevos
- `src/context/AuthContext.tsx` - Contexto de autenticación
- `src/components/LoginPage.tsx` - Página de login
- `src/components/Sidebar.tsx` - Barra lateral de navegación
- `src/components/AppLayout.tsx` - Layout principal con sidebar
- `src/app/modulos/layout.tsx` - Layout para todos los módulos
- `src/app/modulos/analisis-semanal/page.tsx` - Módulo de análisis
- `src/app/modulos/plan-demanda/page.tsx` - Módulo de plan demanda

#### Estilos Actualizados
- Nuevos estilos para login, sidebar y estructura modular
- Animaciones de entrada y transiciones suaves
- Paleta de colores consistente en toda la aplicación

---

## [0.4.1] - 2025-12-17

### Corregido
- **Renombrado archivo de configuración**: `env` → `.env` para que Next.js reconozca las variables de entorno correctamente
- **Servidor iniciado**: Sistema corriendo en http://localhost:3000
- **Script test-connections.js**: Actualizada ruta de `.env` (antes usaba `env`)
- **Conexión MySQL verificada**: Funciona correctamente con IP interna `172.31.68.119` (requiere VPN)

---

## [0.4.0] - 2025-12-06

### Nuevo Botón: Actualizar Disponibilidad Semana
- **Reemplaza** el botón "Calcular Error de Pronóstico"
- **Funcionalidad**:
  - Calcula el lunes de la semana seleccionada (ej: semana 202549 → 01-12-2025)
  - Busca en tabla `StockMeli` los registros de esa fecha con `pais = Chile`
  - Cruza `Sku_Seller` de `Plan_Demanda` con `sku` de `StockMeli`
  - Actualiza el campo `Stock_Inicio_Semana` con el valor de `stock`
  - **Inserta nuevos registros** para SKUs con stock que no estén en el plan:
    - Cuenta = cliente de StockMeli
    - Pronostico = 0, Plan_demanda = 0, PVP_PD = 0
    - Observaciones = "Producto con stock sin plan"
    - Venta_Real = 0, Error = 0, Error_Abs = 0, Perdida_Valorizada = 0
- **Validación**: Si no hay datos de stock para el lunes, muestra error indicando la fecha faltante

### API Nueva
- `/api/update-stock` - Actualiza Stock_Inicio_Semana desde StockMeli

### Mejorado
- **Modal de éxito** para actualización de stock mostrando:
  - Cantidad con stock actualizado
  - Cantidad de nuevos insertados
  - Cantidad sin stock (→0)
  - Fecha de stock utilizada
  - Total de registros en StockMeli
- **SKUs sin coincidencia** ahora se actualizan con `Stock_Inicio_Semana = 0`
- **Soporte para formatos de fecha**: YYYY-MM-DD y DD-MM-YYYY

### Cálculos Automáticos (PASO 7)
- **Venta_Perdida_Stock**: Calcula la venta perdida por falta de stock
  ```
  SI(Error < 0;
     SI(Stock_Inicio_Semana < Plan_Demanda;
        SI(Venta_Real >= Stock_Inicio_Semana;
           -Plan_Demanda + Stock_Inicio_Semana;
           0); 0); 0)
  ```
- **Perdida_Stock_Valorizada**: `Venta_Perdida_Stock × precio`
  - Usa PVP_Prom si > 0, sino usa PVP_PD

---

## [0.3.0] - 2025-12-06

### Cambios Importantes
- **Nueva restricción única**: Ahora es `Semana + Nodo + Cuenta + Sku_Seller` (antes era sin Nodo)
- **Script SQL** para actualizar la restricción: `scripts/update-table-constraint.sql`

### Agregado
- **Selector de Nodo** en la interfaz con 4 opciones:
  - Mercado Libre Chile
  - Falabella Chile
  - Paris Chile
  - Ripley Chile

- **Lógica mejorada de carga de ventas CSV**:
  - ✅ Actualiza registros existentes con venta real
  - ✅ Inserta SKUs nuevos que no estaban en el plan (con Pronostico=0, Plan_demanda=0)
  - ✅ Marca con Venta_Real=0 los SKUs del plan que no tuvieron venta
  
- **Modal de resultados** con estadísticas detalladas:
  - Cantidad de registros actualizados
  - Cantidad de nuevos insertados
  - Cantidad sin venta (marcados a 0)
  - Tabla con detalle de los primeros 50 registros

- **API para cargar Plan inicial** (`/api/upload-plan-csv`)

### Corregido
- Soporte para separador `;` además de `,` en archivos CSV
- Manejo de números con coma decimal (ej: "1,5" → 1.5)

### Agregado - Cálculos Automáticos
- **Cálculo automático de métricas** al cargar ventas:
  - `Error` = Venta_Real - Plan_demanda (número entero)
  - `Error_Abs` = |Venta_Real - Plan_demanda| (número entero)
  - `Perdida_Valorizada` = (Venta_Real - Plan_demanda) × precio (redondeado)
    - Usa `PVP_Prom` si está disponible, sino usa `PVP_PD`
- **Redondeo de valores**:
  - `Venta_Real`: redondea hacia abajo (floor) - ej: 48.7 → 48
  - `Plan_demanda`: redondea hacia arriba (ceil) - ej: 35.2 → 36
  - Resultados siempre son números enteros, sin decimales
- Los cálculos se aplican **siempre** con la misma fórmula:
  - ✅ Registros actualizados (con venta del CSV)
  - ✅ Registros nuevos insertados (SKUs no planificados)
  - ✅ Registros sin venta (Venta_Real = 0, Error = -Plan_demanda)
- **PASO 7 de seguridad**: Al final del proceso, recalcula TODOS los registros de la semana/nodo para asegurar que tengan Error, Error_Abs y Perdida_Valorizada correctos

### Optimizado
- **Procesamiento de CSV 10x más rápido** usando operaciones en lote (batch)
  - Antes: 1 consulta por registro (313s para 1063 registros)
  - Ahora: Lotes de 50 registros en paralelo (~30s para 1063 registros)
- **Indicador de progreso en tiempo real** muestra segundos transcurridos
- **Logs en consola del servidor** para monitorear el progreso

### Mejorado
- **Validación de archivos CSV** con mensajes de error detallados:
  - ❌ Detecta si el archivo no es CSV
  - ❌ Detecta si el archivo está vacío
  - ❌ Detecta columnas faltantes y muestra cuáles son
  - 📋 Muestra el formato esperado del CSV
  - 📌 Muestra ejemplo de cómo debe verse la primera fila
  - 📊 Lista las columnas que sí se encontraron en el archivo

---

## [0.2.0] - 2025-12-06

### Agregado
- **Interfaz Web Completa** con Next.js 14
  - Panel de control con 4 botones de automatización
  - Diseño moderno con tema oscuro y acentos cyan/púrpura
  - Indicadores de estado de conexión (Supabase/MySQL)
  - Selector de semana en formato YYYYWW
  - Log de actividad en tiempo real
  
- **APIs del Backend**
  - `/api/check-connections` - Verificar estado de conexiones
  - `/api/update-sales` - Actualizar ventas reales
  - `/api/calculate-errors` - Calcular errores de pronóstico
  - `/api/upload-sales-csv` - Cargar ventas desde CSV

- **Script SQL** para crear tabla `Plan_Demanda` en Supabase
  - 31 campos según especificación
  - Índices para optimizar búsquedas
  - Políticas RLS configuradas

- **Funcionalidad de carga CSV** como alternativa cuando MySQL no está disponible

### Configuración
- Archivo `env` con credenciales configuradas
- Archivo `.env.local` creado para Next.js
- TypeScript configurado con tipos estrictos

### Notas
- ⚠️ La conexión a MySQL (rdb.instancelatam.com) no está funcionando desde Node.js
- La VPN parece no enrutar el tráfico correctamente desde la terminal
- Se implementó carga de CSV como solución temporal

---

## [0.1.0] - 2025-12-06

### Agregado
- Creación inicial del proyecto
- Archivo `env.example` con plantilla de variables de entorno para:
  - Conexión a Supabase (URL, API Keys)
  - Conexión a MySQL RDB Instance Latam (host, puerto, base de datos, usuario)
- Archivo `.gitignore` para proteger credenciales y archivos sensibles

