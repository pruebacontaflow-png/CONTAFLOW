# Estado actual de ContaFlow
*Actualizado: 2026-11-03 — refleja el código real tras las Fases 1-5*

---

## Stack

| Aspecto | Detalle |
|---|---|
| Framework | Next.js 14 App Router, TypeScript |
| DB | SQLite vía `@libsql/client` (async, sin binarios nativos) |
| Path a DB | `{cwd}/contaflow.db`; Windows: `file:/${path.replace(/\\/g, '/')}` |
| Auth | next-auth v4 · CredentialsProvider · JWT · bcryptjs · 8 h de sesión |
| UI | Tailwind CSS + Radix UI; sin shadcn CLI |
| Libs | recharts, xlsx, papaparse, lucide-react, uuid, date-fns, multer (declarado pero no activo) |
| Paleta | Azul `#185fa5` · Verde `#0F6E56` · Rojo `#993C1D` · Ámbar `#854F0B` |
| Formato | `Intl.NumberFormat('es-AR')` · fechas `dd/mm/aaaa` |
| PDFs | Guardados en `{cwd}/facturas-pdf/` |

---

## Base de datos — tablas existentes

| Tabla | Descripción | Estado |
|---|---|---|
| `proveedores` | CUIT (UNIQUE), razon_social, categoria, email, telefono, condicion_iva, activo | ✅ |
| `clientes` | CUIT (UNIQUE), razon_social, categoria, email, condicion_iva, activo | ✅ |
| `facturas_recibidas` | Comprobantes de compras + todos los campos de Fase 1 (neto_gravado, percep_iva, percep_iibb, hash_pdf, drive_*) y Fase 2 (fecha_pago, numero_op, comprobante_pago_path, certificado_retencion_path) | ✅ |
| `facturas_emitidas` | Comprobantes de ventas + mismos campos ampliados que recibidas (sin fecha_pago) | ✅ |
| `cuentas_bancarias` | banco, tipo, moneda, saldo_actual (saldo manual) | ✅ |
| `movimientos_bancarios` | Movimientos manuales de saldo | ✅ |
| `movimientos` | Genérico (cashflow) | ✅ |
| `vencimientos_fiscales` | Vencimientos con fecha y estado | ✅ |
| `usuarios` | username (UNIQUE), password_hash, rol, proveedor_id, activo | ✅ |
| `retenciones_config` | tipo (ganancias_sicore/iibb_agip/iibb_arba), descripcion, codigo_regimen, alicuota, minimo_no_imponible, acumula_mensual — **seed de ejemplo, revisar con contadora** | ✅ |
| `ordenes_pago` | proveedor_id, fecha, numero, importe_bruto, total_retenciones, importe_neto, cuenta_bancaria_id, estado, comprobante_path | ✅ |
| `ordenes_pago_items` | Relación OP ↔ facturas con importe | ✅ |
| `retenciones_aplicadas` | Por OP: tipo, descripcion, base_calculo, alicuota, importe, certificado_numero | ✅ |
| `plan_cuentas` | 33 cuentas sembradas (FACPCE base): tipo, codigo (UNIQUE), nombre, parent_id, imputable, activo | ✅ |
| `periodos_contables` | UNIQUE(anio, mes), cerrado, fecha_cierre, cerrado_por | ✅ |
| `asientos` | fecha, descripcion, tipo (manual/auto), referencia_id, referencia_tipo, anio, mes, estado | ✅ |
| `asientos_lineas` | asiento_id, cuenta_id, descripcion, debe, haber | ✅ |
| `facturas_iva_detalle` | factura_id, tabla (recibidas/emitidas), alicuota, base_imponible, importe | ✅ |
| `parametros` | 7 mappings cuenta↔código: gastos_default, iva_credito, proveedores, banco_default, retenciones_pagar, iva_debito, ventas_default | ✅ |
| `extractos_bancarios` | cuenta_bancaria_id, fecha_desde/hasta, saldo_inicial/final, total_debitos/creditos, nombre_archivo | ✅ |
| `extractos_lineas` | extracto_id, fecha, descripcion, debito, credito, saldo, categoria, cuenta_contable_id, conciliado, referencia_tipo/id | ✅ |
| `reglas_clasificacion` | nombre, patron, tipo_match (contiene/empieza/termina/exacto), categoria, cuenta_contable_id, prioridad, activo | ✅ |

---

## Rutas de API

| Ruta | Métodos | Fase |
|---|---|---|
| `/api/auth/[...nextauth]` | GET/POST | base |
| `/api/dashboard` | GET | base |
| `/api/proveedores` | GET/POST | base |
| `/api/proveedores/[id]` | GET/PUT/DELETE | base |
| `/api/clientes` | GET/POST | base |
| `/api/clientes/[id]` | GET/PUT/DELETE | base |
| `/api/facturas-recibidas` | GET/POST | base |
| `/api/facturas-recibidas/[id]` | GET/PUT/DELETE | base |
| `/api/facturas-recibidas/[id]/revisar` | PUT | base |
| `/api/facturas-recibidas/[id]/pdf` | GET | base |
| `/api/facturas-emitidas` | GET/POST | base |
| `/api/facturas-emitidas/[id]` | GET/PUT/DELETE | base |
| `/api/facturas-emitidas/[id]/pdf` | GET | base |
| `/api/bancos` | GET/POST | base |
| `/api/bancos/[id]` | GET/PUT/DELETE | base |
| `/api/vencimientos` | GET/POST | base |
| `/api/vencimientos/[id]` | GET/PUT/DELETE | base |
| `/api/cashflow` | GET | base |
| `/api/reportes` | GET (Excel) | base |
| `/api/importacion` | POST (CSV/Excel) | base |
| `/api/conciliacion` | GET/POST | base |
| `/api/usuarios` | POST | base |
| `/api/usuarios/[id]` | PUT | base |
| `/api/usuarios/proveedor` | GET | base |
| `/api/ingesta/comprobantes` | POST (multipart, x-api-key) | Fase 1 |
| `/api/pdfs/[filename]` | GET | Fase 1 |
| `/api/pdf/[...path]` | GET | Fase 1 |
| `/api/bandeja` | GET/POST | Fase 1 |
| `/api/bandeja/[id]` | GET/PUT | Fase 1 |
| `/api/portal/facturas` | GET/POST | Fase 2 |
| `/api/portal/facturas/[id]/descargar` | GET | Fase 2 |
| `/api/portal/proveedor` | GET | Fase 2 |
| `/api/portal/cuenta-corriente` | GET | Fase 2 |
| `/api/ordenes-pago` | GET/POST | Fase 3 |
| `/api/ordenes-pago/[id]` | GET/PUT/DELETE | Fase 3 |
| `/api/ordenes-pago/[id]/pagar` | POST | Fase 3 |
| `/api/retenciones-config` | GET/POST | Fase 3 |
| `/api/retenciones-config/[id]` | PUT/DELETE | Fase 3 |
| `/api/cuentas-corrientes` | GET | Fase 3 |
| `/api/libro-iva` | GET | Fase 4 |
| `/api/asientos` | GET/POST | Fase 4 |
| `/api/asientos/[id]` | GET/DELETE | Fase 4 |
| `/api/periodos` | GET/POST | Fase 4 |
| `/api/periodos/[id]` | GET/PUT | Fase 4 |
| `/api/plan-cuentas` | GET/POST | Fase 4 |
| `/api/plan-cuentas/[id]` | PUT/DELETE | Fase 4 |
| `/api/parametros` | GET/PUT | Fase 4 |
| `/api/extractos` | GET/POST (CSV/XLSX import) | Fase 5 |
| `/api/extractos/[id]` | GET/DELETE | Fase 5 |
| `/api/extractos/[id]/aplicar-reglas` | POST | Fase 5 |
| `/api/extractos/[id]/autoconcilar` | POST | Fase 5 |
| `/api/extractos/[id]/lineas/[lineaId]` | PUT | Fase 5 |
| `/api/reglas-clasificacion` | GET/POST | Fase 5 |
| `/api/reglas-clasificacion/[id]` | PUT/DELETE | Fase 5 |

---

## Páginas de UI

| Página | Ruta | Fase |
|---|---|---|
| Login | `/login` | base |
| Dashboard | `/dashboard` | base |
| Proveedores | `/proveedores` | base |
| Clientes | `/clientes` | base |
| Facturas Recibidas | `/facturas-recibidas` | base |
| Facturas Emitidas | `/facturas-emitidas` | base |
| Saldos Bancarios | `/bancos` | base |
| Vencimientos | `/vencimientos` | base |
| Cash Flow | `/cashflow` | base |
| Reportes (Excel) | `/reportes` | base |
| Importación CSV/Excel | `/importacion` | base |
| Conciliación ARCA | `/conciliacion` | base |
| Portal proveedor | `/portal-proveedor` | Fase 2 |
| Bandeja de revisión | `/bandeja` | Fase 1 |
| Órdenes de pago | `/ordenes-pago` | Fase 3 |
| Cuentas corrientes | `/cuentas-corrientes` | Fase 3 |
| Config. retenciones | `/retenciones-config` | Fase 3 |
| Libro IVA | `/libro-iva` | Fase 4 |
| Plan de cuentas | `/plan-cuentas` | Fase 4 |
| Asientos | `/asientos` | Fase 4 |
| Períodos contables | `/periodos` | Fase 4 |
| Extractos bancarios | `/extractos` | Fase 5 |
| Detalle de extracto | `/extractos/[id]` | Fase 5 |
| Reglas de clasificación | `/reglas-clasificacion` | Fase 5 |

---

## Sidebar — grupos y ítems

| Grupo | Ítems |
|---|---|
| General | Dashboard, Saldos Bancarios, Vencimientos, Cash Flow |
| Compras | Bandeja de revisión, Proveedores, Facturas Recibidas, Órdenes de pago, Cuentas Corrientes, Extractos bancarios, Conciliación ARCA |
| Ventas | Clientes, Facturas Emitidas |
| Contador | Libro IVA, Plan de cuentas, Asientos, Períodos, Reportes, Importación, Config. retenciones, Reglas de clasif. |

---

## Roles y permisos

| Aspecto | Estado |
|---|---|
| Roles existentes | `admin`, `contador`, `proveedor` |
| middleware.ts | ✅ Redirige por rol |
| Portal proveedor aislado | ✅ `proveedor_id` siempre del JWT, nunca de params |
| UI oculta acciones por rol | ✅ (admin ve botones de edición; contador no) |
| **Bloqueo a nivel de API** | ⚠️ Solo `admin` está validado en algunas rutas; `contador` puede mutar via API directa |
| Tabla de auditoría | ❌ No implementada |
| 2FA | ❌ No implementada |

---

## Lógica de negocio — estado detallado

### Retenciones (Fase 3)
- **Tabla `retenciones_config`**: ✅ tipos ganancias_sicore / iibb_agip / iibb_arba
- **Cálculo al crear OP**: ⚠️ aplica alícuota sobre `importe_bruto` total; **no descuenta IVA de la base**, no aplica MNI, no acumula por proveedor en el mes
- **Certificados de retención**: ⚠️ guarda `certificado_numero` en tabla pero no genera PDF ni permite export Excel por período

### Pagos (Fase 3)
- **Múltiples facturas por OP**: ✅ vía `ordenes_pago_items`
- **Pagos parciales / adelantos**: ❌ no implementado; cada ítem imputa el importe completo de la factura
- **Estado de facturas**: ✅ al pagar una OP se marcan las facturas incluidas como `pagada`

### Cuentas corrientes (Fase 3)
- **Vista básica**: ✅ `/cuentas-corrientes` muestra saldo por proveedor
- **Historia completa con saldo corrido**: ❌ sin movimiento a movimiento con saldo acumulado
- **Antigüedad de deuda**: ❌ no implementado

### Cierre de período (Fase 4)
- **Bloqueo de asientos**: ✅ `POST /api/asientos` verifica que el período no esté cerrado
- **Bloqueo de facturas/OPs/movimientos bancarios**: ❌ solo bloquea asientos; facturas y OPs se pueden cargar en períodos cerrados
- **Verificación de balance**: ✅ el cierre valida Σdebe = Σhaber del período (tolerancia $0.01)

### Asientos automáticos (Fase 4)
- **`lib/asientos-auto.ts`**: ✅ funciones `crearAsientoCompra`, `crearAsientoVenta`, `crearAsientoPago` definidas
- **Llamado desde flujos**: ❌ las funciones existen pero no se invocan desde las rutas de facturas/OPs; los asientos se cargan solo manualmente

### Libro IVA (Fase 4)
- **Compras y ventas**: ✅ filtro por año/mes, columnas por alícuota, totales, export Excel
- **Base: `facturas_recibidas`/`emitidas`**: ✅ usa los campos neto_gravado, percepcion_iva, percepcion_iibb

### Extractos bancarios (Fase 5)
- **Import CSV/XLSX**: ✅ detección automática de columnas por keywords
- **Auto-conciliación**: ✅ cruza con `ordenes_pago` (débitos) y `facturas_emitidas` (créditos) por monto ±$1 y fecha ±5 días
- **Reglas de clasificación**: ✅ prioridad DESC, primer match gana; se aplican en import y bajo demanda
- **Mapeo de columnas guardado por banco**: ❌ no implementado; se detecta dinámicamente cada vez
- **Detección de duplicados por hash/contenido**: ❌ no implementado; puede importar el mismo extracto dos veces

---

## Brechas identificadas (pendientes para Bloque A)

| # | Área | Brecha |
|---|---|---|
| A1 | Retenciones | Base = neto sin IVA; aplicar MNI; acumular por proveedor/mes; importar padrón ARBA/AGIP con fechas de vigencia |
| A2 | Certificados | Numeración correlativa; generación PDF; export Excel por período/impuesto |
| A3 | Pagos | Imputación parcial a múltiples facturas; anticipos a proveedores |
| A4 | CC | Historia completa con saldo corrido; antigüedad de deuda |
| A5 | Períodos | Bloqueo de facturas, OPs, cobros y movimientos bancarios en períodos cerrados |
| A6 | Asientos auto | Invocar `asientos-auto.ts` desde facturas recibidas, emitidas, OPs y cobros; exportar Libro Diario y Mayor |
| A7 | Extractos | Guardar mapeo de columnas por banco; hash/contenido para detectar duplicados al importar |
| A8 | Permisos API | Validar rol `contador` como solo-lectura en todos los endpoints de mutación |
| A9 | WAL/backup/audit | WAL mode + busy_timeout en SQLite; script de backup; tabla `auditoria` (usuario, fecha, accion, entidad, valor_anterior, valor_nuevo) |

---

## Invariantes del proyecto

1. **Ningún valor impositivo hardcodeado** — alícuotas, mínimos, regímenes, códigos: todos en tablas de configuración editables
2. **`proveedor_id` del JWT** — nunca de parámetros del cliente
3. **Migraciones incrementales e idempotentes** — `CREATE TABLE IF NOT EXISTS` + `tryAlter()` para columnas; `INSERT OR IGNORE` para seeds; backup de `contaflow.db` antes de cada migración
4. **Comprobante recibido mal cargado**: se edita mientras el período esté abierto y no esté pagado; cada cambio va al registro de auditoría (pendiente implementar). Un comprobante emitido con CAE no se edita: se corrige con nota de crédito.
5. **Datos reales** (`datos/`, PDFs, `.env.local`) nunca al repositorio git
6. **Decisiones dependientes de la contadora**: configuradas como editables en tablas, documentadas en `docs/decisiones-pendientes.md`
7. **UI siempre en español**; formato argentino para números y fechas

---

## Archivos clave

| Archivo | Contenido |
|---|---|
| `src/lib/db.ts` | Schema completo + todas las migraciones + seeds |
| `src/lib/auth.ts` | next-auth config, JWT con rol y proveedor_id |
| `src/lib/asientos-auto.ts` | Funciones para asientos automáticos (definidas, pendiente integrar) |
| `src/lib/utils.ts` | `formatCurrency`, `formatDate` |
| `src/components/Sidebar.tsx` | Navegación completa con 4 grupos |
| `docs/decisiones-pendientes.md` | Preguntas pendientes para la contadora |
| `docs/api-ingesta.md` | Contrato del endpoint de ingesta para n8n |
