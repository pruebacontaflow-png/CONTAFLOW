# ContaFlow — Sistema de Gestión Contable para PyMEs argentinas

## Requisitos previos

- Node.js 18 o superior (ya tenés v24 ✓)
- npm 9 o superior (ya tenés v11 ✓)

---

## Instalación

```bash
# 1. Entrar a la carpeta del proyecto
cd Documents/contaflow

# 2. Instalar dependencias
npm install

# 3. Inicializar la base de datos con datos de ejemplo
node init-db.js

# 4. Arrancar el servidor de desarrollo
npm run dev
```

Abrí el navegador en: **http://localhost:3000**

---

## Usuarios de acceso

| Rol | Usuario | Contraseña | Permisos |
|-----|---------|-----------|---------|
| Administrador | `admin` | _(establecer con `npm run cambiar-clave`)_ | Acceso completo (ABM) |
| Contador | `contador` | _(establecer con `npm run cambiar-clave`)_ | Solo lectura + exportación |

---

## Módulos disponibles

### General
- **Dashboard** — Métricas principales, gráficos de evolución, próximos vencimientos
- **Saldos Bancarios** — ABM de cuentas con historial de actualizaciones
- **Vencimientos** — Vista unificada con alertas de color (verde/amarillo/rojo)
- **Cash Flow** — Tabla y gráfico mensual de ingresos vs egresos proyectados

### Compras
- **Proveedores** — ABM completo con estado automático y facturas asociadas
- **Facturas Recibidas** — Carga manual con cálculo automático de IVA
- **Conciliación ARCA** — Parser TXT del IVA Compras de AFIP/ARCA con cruce automático

### Ventas
- **Clientes** — ABM completo con facturas asociadas
- **Facturas Emitidas** — Igual estructura que recibidas, estados de cobro

### Contador
- **Reportes** — Estado de resultados, IVA, facturas · Filtros por año/semestre · Exportación Excel
- **Importación** — Carga masiva desde Excel/CSV con plantillas descargables

---

## Variables de entorno (.env.local)

```env
NEXTAUTH_SECRET=<clave-aleatoria-larga>
NEXTAUTH_URL=http://localhost:3000
ADMIN_USER=admin
ADMIN_PASS=<contraseña-segura>
COUNTER_USER=contador
COUNTER_PASS=<contraseña-segura>
```

---

## Stack técnico

- **Next.js 14** con App Router
- **TypeScript**
- **Tailwind CSS**
- **SQLite** con better-sqlite3 (archivo `contaflow.db`)
- **next-auth** para autenticación JWT
- **Recharts** para gráficos
- **xlsx (SheetJS)** para exportación Excel
- **PapaParse** para importación CSV
- **Lucide React** para iconos

---

## Formato numérico

Todos los importes usan `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`.  
Las fechas se muestran en formato `dd/mm/aaaa`.

---

## Datos de ejemplo

El script `init-db.js` crea:
- 7 proveedores + 5 clientes
- 10 facturas recibidas + 10 facturas emitidas
- 4 cuentas bancarias (ARS + USD)
- 10 vencimientos fiscales (pendientes y pagados)
