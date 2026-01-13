# Plan Demanda - Automatización de Proceso

Sistema de automatización para la gestión del Plan de Demanda desarrollado para Instance Latam.

## 🚀 Características

- **Módulo Análisis Semanal**: Carga y análisis de datos de demanda, ventas y stock
- **Módulo Plan Demanda**: Proyección de demanda con escenarios configurables
- **Sistema de Autenticación**: Login seguro con protección de rutas
- **Integración con Supabase**: Base de datos en la nube
- **Importación CSV**: Carga masiva de datos desde archivos CSV

## 📋 Requisitos Previos

- Node.js 18.20.4
- npm o yarn
- Cuenta en Supabase (para base de datos)

## 🛠️ Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/TU_USUARIO/plan-demanda-automatizacion.git
cd plan-demanda-automatizacion
```

2. Instalar dependencias:
```bash
npm install
```

3. Configurar variables de entorno:
```bash
cp .env.example .env.local
```

4. Editar `.env.local` con tus credenciales de Supabase:
```
NEXT_PUBLIC_SUPABASE_URL=tu_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
```

5. Ejecutar en modo desarrollo:
```bash
npm run dev
```

6. Abrir [http://localhost:3000](http://localhost:3000)

## 🔐 Credenciales por Defecto

- **Usuario**: Admin
- **Contraseña**: Instance.01

## 📁 Estructura del Proyecto

```
├── src/
│   ├── app/
│   │   ├── api/           # Endpoints del backend
│   │   ├── modulos/       # Páginas de módulos
│   │   └── page.tsx       # Página principal
│   ├── components/        # Componentes React
│   ├── context/           # Contextos (Auth)
│   └── lib/               # Utilidades (Supabase)
├── scripts/               # Scripts SQL y de configuración
├── public/                # Archivos estáticos
└── package.json
```

## 🗄️ Base de Datos

El proyecto requiere las siguientes tablas en Supabase:
- `Plan_Demanda` - Datos principales del plan
- `escenarios_plan_demanda` - Escenarios de proyección
- `historial_cambios_plan` - Auditoría de cambios

Los scripts SQL están en la carpeta `/scripts`.

## 📊 Módulos Disponibles

### Análisis Semanal
- Carga de Plan de Demanda (CSV)
- Carga de Ventas Reales (CSV)
- Actualización de Stock
- Carga de Escenarios

### Plan Demanda
- Visualización de proyecciones por semana
- Aplicación de escenarios (Venta, Descuento, Sobreprecio)
- Gráficos de tendencia
- Exportación de datos

## 🎨 Tecnologías

- **Frontend**: Next.js 14, React, TypeScript
- **Estilos**: CSS personalizado con variables
- **Base de Datos**: Supabase (PostgreSQL)
- **Autenticación**: Context API con localStorage

## 📝 Changelog

Ver [changelog.md](./changelog.md) para el historial de cambios.

## 👥 Equipo

Desarrollado para Instance Latam.

## 📄 Licencia

Uso interno - Instance Latam

