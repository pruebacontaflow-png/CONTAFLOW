# Plan Etapa 4 — ContaFlow IT Click Video S.A.

_Basado en reunión del 06/11/2026 con Maricel. 26 puntos + referencias de SAP, Cresium y dashboard comercial._
_Redactado: 06/11/2026_

---

## 0. Estado de bloques previos

### Bloques A–D (prompt anterior)
| Bloque | Descripción | Estado |
|--------|-------------|--------|
| A | 9 categorías de bugs (retenciones, numeración, pagos parciales, CC, cierre, asientos, extractos, permisos, WAL) | ✅ Completado |
| B | Eliminar portal proveedor. 2 roles: admin y contador | ✅ Completado |
| C | Google Drive OAuth2 + Claude AI PDF extraction + sync 10 min | ✅ Completado |
| D | docs/mapa-tango-contaflow.md generado | ✅ Completado |

### Bloques de esta sesión (06/11/2026 →)
| Bloque | Descripción | Estado |
|--------|-------------|--------|
| B (UI) | B2 Lista PI acreedores SAP, B11 dashboard comercial dark navy, B15 Chequeras, B20 Lote de pagos Cresium | ✅ Completado |
| C (datos) | Carga datos reales 2025: acuerdos, comisiones, caja chica, rendiciones | ✅ Completado 11/11/2026 |

**Detalle BLOQUE C — carga de datos 2025:**

| Ítem | Descripción | Resultado |
|------|-------------|-----------|
| C.1 | 22 acuerdos comerciales 2025 | ✅ 22 importados. 21 sin `cliente_id` (pendiente asignación manual) |
| C.2 | Comisiones + tramos + presupuesto | ✅ `comisiones_config` 10%, 4 tramos, 12 meses ppto 2025 + 68 celdas cliente. Validado: sep=704.250 ✓, ago=1.337.420 ✓, nov=1.697.500 ✓ |
| C.3 | 213 movimientos caja chica (4 cajas) | ✅ Saldos iguales al CSV: TO Pesos diff=0, TO USD diff=0, Glup! USD diff=0, Control Mari diff=0 |
| C.4 | Stock guías Time Out | ✅ Ya importado en BLOQUE A (709 unidades, 38 movimientos) |
| C.5 | 120 archivos de rendiciones | ✅ 120 importados. 2 sin persona (asignación manual): "Caja chica Lu Ravazzolli" y "FACTURA B 0009-00014777" |

### Correcciones post-carga (sesión 04/11/2026)
| Ítem | Descripción | Estado |
|------|-------------|--------|
| PDFs | API unificada `/api/pdf/[...path]`, PDFs renombrados, CUIT + botón en listados | ✅ Completado |
| OPs 2025 | 560 OPs importadas desde `pagos-2025.csv` | ✅ Completado |
| Retenciones SICORE | 44 certificados importados | ✅ Completado |
| Estado facturas | `estado_31_12_2025` actualizado en 829 FR y 158 FE | ✅ Completado |

### Items pendientes pequeños (a terminar antes de BLOQUE 1)
| # | Ítem | Qué falta | Dónde |
|---|------|-----------|-------|
| P1 | Dashboard con NCs | El dashboard usa `estado = 'pendiente_pago'` (campo anterior). Debe usar `estado_31_12_2025` y mostrar NCs como categoría separada en CxP | `src/app/api/dashboard/route.ts` + `src/app/dashboard/page.tsx` |
| P2 | PDF de la OP | Las OPs tienen `comprobante_pdf_path` en DB pero no hay botón "Ver PDF" en el listado de órdenes de pago | `src/app/ordenes-pago/page.tsx` |

---

## 1. Menú nuevo por áreas

La reunión pide reorganizar por áreas de trabajo. El menú actual tiene 5 grupos (General, Compras, Ventas, Contador, Sistema). La nueva estructura:

```
INICIO
  Dashboard
  Vencimientos / Calendario ← unificar en una sola pantalla con vista calendario

TESORERÍA
  Extractos bancarios
  Cheques                   ← NUEVO
  Tarjeta corporativa       ← NUEVO
  Viáticos y comidas        ← NUEVO
  Fondo Fijo / Caja chica   ← NUEVO
  Lote de Pagos             ← NUEVO
  Cash Flow
  Impuestos y servicios     ← NUEVO

PROVEEDORES
  Maestro de proveedores    ← mejora existente
  Facturas Recibidas
  Órdenes de Pago
  Cuentas Corrientes

FACTURACIÓN / VENTAS
  Clientes
  Facturas Emitidas
  Créditos y Cobranzas      ← NUEVO

CONTABILIDAD
  Libro IVA
  Plan de cuentas
  Asientos
  Períodos
  Conciliación ARCA
  Bandeja de revisión
  Reportes
  Config. retenciones
  Reglas de clasif.

COMERCIAL                   ← NUEVO módulo completo
  Dashboard Comercial
  Acuerdos
  Comisiones

RRHH                        ← NUEVO módulo completo
  Empleados
  Haberes / Cargas sociales

SISTEMA
  Minutas                   ← NUEVO (IA)
  Importación
  Google Drive
  Usuarios
  Chatbot                   ← NUEVO (IA)
```

> **Nota:** "Saldos Bancarios" se absorbe en Extractos. "Libro IVA" y "Importación ARCA" quedan en Contabilidad. El módulo de stock se deja como decisión pendiente (§9 abajo).

---

## 2. Los 26 puntos de la reunión

| # | Punto de la reunión | Área / Módulo | Estado actual | Tablas / Pantallas nuevas | Bloque |
|---|---------------------|---------------|---------------|--------------------------|--------|
| 1 | Dividir por área (Tesorería, Facturación, Proveedores, Contabilidad, Fondo Fijo, Bancos, Comercial) | Menú / Sidebar | Sidebar plano con 5 grupos | Reorganizar `Sidebar.tsx` sin cambio de rutas | 1 |
| 2 | En FR: número de proveedor interno + nombre (imitar SAP) | Proveedores / FR | Existe proveedor en FR, sin código interno | Columna `codigo_proveedor` en tabla `proveedores` + mostrar en listado FR | 1 |
| 3 | Maestro de proveedores: código, dirección, teléfono, mail, impuestos/retenciones, link Drive, categoría ARCA | Proveedores | Existen email, teléfono, dirección, CBU. Faltan: código, alias CBU, link Drive, impuestos a matchear | Migrar `proveedores` (+`codigo_proveedor`, +`alias_cbu`, +`drive_carpeta`). Importar `proveedores-maestro.csv` (166 proveedores). Mejorar pantalla maestro | 1 |
| 4 | Conexión ARCA: emitir FE desde ContaFlow y que ARCA tome el CAE, o replicar | Sistema / ARCA | Existe conciliación receptiva (lectura). Emisión directa requiere homologación CAFe/WSDL | Integración emisión ARCA (AFIP WS). Pantalla "Emitir Factura" con CAE. Requiere credenciales y certificado | 4 |
| 5 | Viáticos y comidas (dentro de Tesorería) | Tesorería | No existe | Tabla `viaticos` (empleado, fecha, tipo, importe, descripción, comprobante). Nueva pantalla `/viaticos` | 2 |
| 6 | NCs en negativo: si existe FC + NC que la anula, el balance da $0 | Proveedores / Ventas | NCs importadas como comprobantes separados. Saldo CC las considera por signo, pero no se muestra explícitamente | Fix en listado FR/FE para mostrar NCs con importe negativo. Fix en dashboard. Revisar cálculo CC | 1 (P1 ya) |
| 7 | Dashboard: aging CxC, saldo bancario, ganancias por inversiones, facturas vencidas, facturas por cobrar | Inicio | Dashboard existe. Falta aging real CxC y datos de inversiones | Mejorar `dashboard/route.ts`: aging CxP y CxC por tramos (0-30, 30-60, +60). Usar `estado_31_12_2025`. Inversiones: tabla nueva o campo `cuenta_bancaria` tipo "inversión" | 1 |
| 8 | Bancos: subir nómina de banco, extracto bancario | Tesorería | Extractos bancarios (Credicoop) existen. Nómina de banco = otro tipo de extracto (tabla BPN del banco) | Extender `extractos` para múltiples tipos. O tabla `nominas_banco` separada | 2 |
| 9 | Control de stock (si vendemos productos): inventario, categorías | Comercial | No existe. Solo servicios en 2025 | Tabla `productos` (código, nombre, categoría, stock). Decisión pendiente de contadora: ¿la empresa vende productos físicos? | 3 |
| 10 | Módulo Comercial: acuerdos Leandro, dashboard comisiones, alta comercial por zona, cálculo comisiones s/acuerdos | Comercial | No existe | Tablas: `comerciales` (nombre, zona), `acuerdos` (cliente, comercial, monto, período, estado), `comisiones` (acuerdo, período, base, alícuota, importe). Pantallas: Acuerdos + Dashboard | 3 |
| 11 | Diseño dashboard Comercial (referencia imagen: TOP clientes, TOP vendedores, comisiones, beneficios vs facturación) | Comercial | No existe | Ver imagen referencia en docs. `recharts` existente. Métricas: top clientes, top comerciales, comisiones del mes, % beneficio | 3 |
| 12 | Nota de débito interna (en facturas recibidas, para cerrar contabilidad por diferencias) | Proveedores | No existe | Nuevo tipo `nota_debito_interna` en `facturas_recibidas`. Campo `es_interna=1` y `motivo`. Pantalla de alta manual. No va a ARCA | 1 |
| 13 | Tarjeta de crédito corporativa: alta de tarjeta, gastos mensuales, macheo con factura | Tesorería | No existe | Tablas: `tarjetas_corporativas` (banco, número, titular, límite), `gastos_tarjeta` (tarjeta_id, fecha, comercio, importe, factura_id nullable). Pantalla de carga y macheo | 2 |
| 14 | Tipo de cambio: proporcional compra/venta Banco Nación, configurable | Proveedores / Ventas | No existe (hardcoded tipo_cambio=1 en Invoices del exterior) | Tabla `tipos_cambio` (fecha, moneda, compra, venta, fuente). Pantalla de carga manual + opcional scraping BNA. Usar en FR/FE exterior | 1 |
| 15 | Alta de cheques (Tesorería) — referencia imagen SAP remesa | Tesorería | No existe | Tabla `cheques` (banco, número, fecha, beneficiario, importe, estado, orden_pago_id). Pantalla CRUD. Integrar con OPs | 2 |
| 16 | Fondo Fijo / Caja Chica: recibos que justifican la salida en efectivo | Tesorería | No existe | Tabla `fondo_fijo_movimientos` (fecha, tipo, importe, descripcion, comprobante_pdf). Pantalla de carga + resumen de caja | 2 |
| 17 | Cuentas contables asociadas a proveedores y facturación | Contabilidad | Existe `cuenta_contable_id` en `proveedores`. En FR/FE: `cuenta_contable_id` en `facturas_recibidas` | Verificar que el campo se muestra en las pantallas de alta/edición. Agregar al maestro de proveedores | 1 (parte de §3) |
| 18 | Módulo Créditos y Cobranzas: seguimiento de cobranzas, alerta plazo vencido, aviso a legales, recibos | Facturación / Ventas | Existe `clientes`, `facturas-emitidas` y `cuentas-corrientes`. Falta seguimiento activo | Tabla `cobranzas` (factura_id, estado_gestion, fecha_contacto, notas, resultado). Pantalla de seguimiento. Alertas por días vencidos | 3 |
| 19 | Calendario: control de seguimientos de impuestos, seguros | Inicio | Existe `/vencimientos` (tabla `vencimientos_fiscales`). Falta vista calendario visual | Agregar vista calendario (mensual/semanal) a `/vencimientos`. Usar date-fns ya instalado | 1 |
| 20 | Lote de Pagos: aging por vto (0-30, 30-60, +60), botón "Agregar al lote" — referencia imagen Cresium | Proveedores / Tesorería | Existe aging básico en `/cuentas-corrientes`. Falta lote | Tabla `lotes_pago` + `lotes_pago_items`. Pantalla de aging con checkbox y botón lote. Flag "prioritario" para +60 días | 1 |
| 21 | Prioritario a vencido +60 días | (parte de §20) | (parte de §20) | Campo `prioridad` en aging / lote. Badge rojo automático cuando días_vencidos > 60 | 1 |
| 22 | Módulo Impuestos y Servicios: débitos automáticos (celular, impuestos), pagos manuales (alquileres) | Tesorería | Existe `vencimientos_fiscales` básico | Tabla `servicios_recurrentes` (descripción, tipo, proveedor_id nullable, monto, periodicidad, fecha_próximo_vto, cbu_débito). Pantalla de gestión. Integración con extracto para matcheo automático | 2 |
| 23 | Módulo RRHH: alta de empleados, haberes, cargas sociales | RRHH | No existe | Tablas: `empleados` (nombre, CUIL, categoría, fecha_ingreso, CBU, sueldo_básico), `liquidaciones` (empleado_id, período, bruto, deducciones, neto). Pantalla básica. Sin cálculo automático de AFIP en etapa 1 | 3 |
| 24 | Minutas: Comercial / Admin y Finanzas / Producción. Carga automática desde Google Meet — referencia tweet bot IA | Sistema / IA | Existe Drive sync. No existe resumen de Meet | Pipeline: Meet recording → Drive → Claude AI resume + clasifica → guarda en tabla `minutas`. Pantalla de minutas con filtro por área | 4 |
| 25 | Chatbot: desde la app y WhatsApp. Responde "¿cuánto le debemos a X proveedor?" | Sistema / IA | No existe | API `/api/chat` con Claude + tool use sobre la DB. Frontend: panel chat en la app. WhatsApp: Twilio o Meta API (fase posterior) | 4 |
| 26 | Reportes financieros (dentro de Tesorería): cashflow, vencimientos +60 días, presupuesto por área (editorial-comercial), P&M. Contabilizar SICORE, DDJJ, IVA, moratorias, IIBB, VEP en banco | Contabilidad / Tesorería | Existe `/cashflow` y `/reportes`. Falta presupuesto por área y contabilización automática impuestos | Tabla `presupuestos` (área, período, monto). Mejorar `/cashflow` con proyección. Pantalla impuestos: vincular VEP con extracto | 2 |

---

## 3. Plan por bloque

### BLOQUE 0-previo (antes de empezar BLOQUE 1)
**Items pequeños pendientes, estimado: 2–3 horas**

1. **P1 — Dashboard con NCs**
   - Actualizar `GET /api/dashboard` para usar `estado_31_12_2025` en vez de `estado`
   - Agregar tile "Notas de crédito recibidas" (count + monto total)
   - Archivo: `src/app/api/dashboard/route.ts` + `src/app/dashboard/page.tsx`

2. **P2 — PDF de la OP en listado**
   - Agregar botón `<FileText>` en la fila de cada OP que tenga `comprobante_pdf_path`
   - Enlace a `/api/pdf/comprobantes/{filename}`
   - Archivo: `src/app/ordenes-pago/page.tsx`

---

### BLOQUE 1 — Fundamentos y mejoras FR/FE/Proveedores
**Prioridad alta. Bases para todo lo que sigue. Estimado: 2–3 semanas.**

**Pantallas / funciones:**

1. **Reorganización del menú** (§1)
   - Nuevos grupos en `Sidebar.tsx`: Tesorería, Comercial, RRHH (vacíos inicialmente)
   - Sin cambiar rutas existentes

2. **Maestro de proveedores ampliado** (§2, §3, §17)
   - Migración: `+codigo_proveedor TEXT`, `+alias_cbu TEXT`, `+drive_carpeta TEXT`
   - Script de importación desde `datos/2026/importar/proveedores-maestro.csv` (166 proveedores)
   - Pantalla maestro: mostrar código, link Drive, teléfono, mail, impuestos
   - En listado FR: agregar columna "Código" junto al nombre del proveedor

3. **NCs en negativo** (§6)
   - En listado FR/FE: si `tipo_comprobante` es NC, mostrar importe en rojo con signo negativo
   - En CC: verificar que el saldo considera NCs correctamente
   - En dashboard: fix P1

4. **Nota de débito interna** (§12)
   - Tabla: agregar `es_interna INTEGER DEFAULT 0` y `motivo TEXT DEFAULT ''` a `facturas_recibidas`
   - Alta manual de NDI desde pantalla FR (botón "+ Nota de débito interna")
   - No va a ARCA, no requiere CUIT emisor real

5. **Tipo de cambio** (§14)
   - Nueva tabla `tipos_cambio (id, fecha, moneda TEXT, compra REAL, venta REAL, fuente TEXT, created_at)`
   - Pantalla `/tipo-cambio`: carga manual de cotizaciones
   - En FR/FE exterior: calcular `importe_pesos = importe_usd * tipo_cambio.venta` al guardar
   - Configuración: proporcional (compra + venta) / 2 o solo venta, según decisión contadora (→ decisiones-pendientes.md §16)

6. **Lote de Pagos + Aging** (§20, §21)
   - Nueva tabla `lotes_pago (id, nombre, fecha, estado, creado_por, total)`
   - Nueva tabla `lotes_pago_items (id, lote_id, factura_id, importe)`
   - En pantalla FR y CC: columna "Días vencido", badge rojo si >60 días
   - Botón "Agregar al lote" al seleccionar filas en aging
   - Pantalla `/lote-pagos`: ver / editar / exportar lote activo

7. **Dashboard mejorado** (§7)
   - Aging CxP por tramos: 0-30, 30-60, >60 días (barras)
   - Aging CxC por tramos: 0-30, 30-60, >60 días (barras)
   - Usar `estado_31_12_2025` para cálculo de pendientes
   - Tile "Saldo bancario total" (ya existe, verificar)

8. **Calendario de vencimientos** (§19)
   - Agregar vista calendario mensual a `/vencimientos`
   - Toggle: lista / calendario
   - Eventos en colores por tipo (fiscal, factura, seguro)

**DB migrations BLOQUE 1:**
```sql
ALTER TABLE proveedores ADD COLUMN codigo_proveedor TEXT DEFAULT '';
ALTER TABLE proveedores ADD COLUMN alias_cbu TEXT DEFAULT '';
ALTER TABLE proveedores ADD COLUMN drive_carpeta TEXT DEFAULT '';
ALTER TABLE facturas_recibidas ADD COLUMN es_interna INTEGER DEFAULT 0;
ALTER TABLE facturas_recibidas ADD COLUMN motivo_interna TEXT DEFAULT '';
CREATE TABLE IF NOT EXISTS tipos_cambio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  moneda TEXT NOT NULL DEFAULT 'USD',
  compra REAL DEFAULT 0,
  venta REAL DEFAULT 0,
  fuente TEXT DEFAULT 'manual',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lotes_pago (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  fecha TEXT NOT NULL,
  estado TEXT DEFAULT 'borrador',
  creado_por TEXT DEFAULT '',
  total REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS lotes_pago_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lote_id INTEGER NOT NULL,
  factura_id INTEGER,
  importe REAL DEFAULT 0,
  descripcion TEXT DEFAULT ''
);
```

---

### BLOQUE 2 — Tesorería y Finanzas
**Nuevos módulos dentro del área Tesorería. Estimado: 3–4 semanas.**

1. **Cheques** (§15 — ref. imagen SAP remesa)
   - Tabla `cheques (id, banco, numero TEXT, fecha_emision TEXT, fecha_cobro TEXT, beneficiario TEXT, importe REAL, estado TEXT, orden_pago_id INTEGER nullable)`
   - Estados: "en cartera", "depositado", "cobrado", "rechazado", "anulado"
   - Pantalla `/cheques`: CRUD + link a OP

2. **Tarjeta corporativa** (§13)
   - Tabla `tarjetas_corporativas (id, banco, numero_ultimos4 TEXT, titular TEXT, limite REAL, moneda TEXT DEFAULT 'ARS', activa INTEGER DEFAULT 1)`
   - Tabla `gastos_tarjeta (id, tarjeta_id, fecha TEXT, comercio TEXT, importe REAL, moneda TEXT, factura_id INTEGER nullable, descripcion TEXT)`
   - Pantalla `/tarjeta-corporativa`: carga de gastos + macheo con FR

3. **Viáticos y comidas** (§5)
   - Tabla `viaticos (id, empleado TEXT, fecha TEXT, tipo TEXT, destino TEXT, importe REAL, moneda TEXT DEFAULT 'ARS', comprobante_pdf TEXT DEFAULT '', descripcion TEXT, aprobado INTEGER DEFAULT 0)`
   - Pantalla `/viaticos`: carga, aprobación, exportación

4. **Fondo Fijo / Caja Chica** (§16)
   - Tabla `fondo_fijo_movimientos (id, fecha TEXT, tipo TEXT CHECK(tipo IN ('ingreso','egreso')), importe REAL, descripcion TEXT, comprobante_pdf TEXT DEFAULT '', saldo_resultante REAL DEFAULT 0)`
   - Pantalla `/fondo-fijo`: libro caja, carga de recibos, saldo actual

5. **Impuestos y servicios recurrentes** (§22, §26 parcial)
   - Tabla `servicios_recurrentes (id, descripcion TEXT, tipo TEXT, proveedor_id INTEGER nullable, monto REAL, moneda TEXT DEFAULT 'ARS', periodicidad TEXT, fecha_proximo_vto TEXT, cbu_debito TEXT DEFAULT '', estado TEXT DEFAULT 'activo', notas TEXT)`
   - Pantalla `/impuestos-servicios`: alta, listado, próximos vencimientos
   - Tipos: "débito automático", "pago manual", "impuesto AFIP", "alquiler"

6. **Nómina de banco** (§8)
   - Extender extractos para tipo "nómina" (BPN/COELSA)
   - O tabla `nominas_banco (id, banco, fecha, archivo_pdf TEXT, total REAL, empleados INTEGER)` según lo que decida contadora

7. **Reportes financieros mejorados** (§26)
   - Tabla `presupuestos (id, area TEXT, periodo TEXT, monto REAL, notas TEXT)`
   - Mejorar `/cashflow`: proyección a 60/90 días con vencimientos conocidos
   - Pantalla `/reportes`: agregar P&M (Pérdidas y Ganancias) y presupuesto vs real por área

8. **Contabilización SICORE / DDJJ / IVA** (§26 impuestos)
   - Pantalla de impuestos: listar VEPs del extracto, vincular con período
   - Tabla `declaraciones_juradas (id, tipo TEXT, periodo TEXT, vep TEXT, monto REAL, fecha_pago TEXT, extracto_linea_id INTEGER nullable)`
   - Decisión pendiente: contadora define qué presentaciones procesa ContaFlow vs. Tango (→ decisiones-pendientes.md §17)

---

### BLOQUE 3 — Comercial, RRHH, Créditos y Cobranzas
**Módulos nuevos de gestión. Estimado: 3–4 semanas.**

1. **Módulo Comercial** (§10, §11)
   - Tabla `comerciales (id, nombre, zona TEXT, email, telefono, activo INTEGER DEFAULT 1)`
   - Tabla `acuerdos (id, cliente_id INTEGER, comercial_id INTEGER, descripcion TEXT, monto_base REAL, moneda TEXT, fecha_inicio TEXT, fecha_fin TEXT nullable, estado TEXT DEFAULT 'activo', comision_pct REAL DEFAULT 0)`
   - Tabla `comisiones (id, acuerdo_id INTEGER, periodo TEXT, base_imponible REAL, alicuota REAL, importe REAL, estado TEXT DEFAULT 'pendiente', fecha_pago TEXT nullable)`
   - Pantallas: `/comercial/acuerdos`, `/comercial/comisiones`
   - Dashboard `/comercial/dashboard`: TOP clientes (bar chart), TOP comerciales, % beneficio vs facturación, tabla de comisiones del mes (ver imagen referencia image1.png del docx)

2. **Stock e inventario** (§9) — _condicional_
   - Solo se implementa si la empresa vende productos físicos (decisión contadora → decisiones-pendientes.md §18)
   - Tabla `productos (id, codigo TEXT, nombre TEXT, categoria TEXT, stock_actual REAL DEFAULT 0, unidad TEXT, precio_venta REAL DEFAULT 0, activo INTEGER DEFAULT 1)`
   - Pantalla `/productos`: alta y control de stock

3. **Créditos y Cobranzas** (§18)
   - Tabla `cobranzas_seguimiento (id, factura_id INTEGER NOT NULL, estado_gestion TEXT, fecha_contacto TEXT, notas TEXT, resultado TEXT, proxima_accion TEXT, proxima_fecha TEXT)`
   - Tabla `recibos_cobro (id, factura_id INTEGER, fecha TEXT, importe REAL, medio_pago TEXT, referencia TEXT, pdf_path TEXT DEFAULT '')`
   - Pantalla `/creditos-cobranzas`: aging CxC con gestión activa, alertas +plazo, generación de recibos
   - Regla configurable: días de gracia antes de marcar "en gestión" (→ decisiones-pendientes.md §19)

4. **RRHH básico** (§23)
   - Tabla `empleados (id, nombre TEXT, apellido TEXT, cuil TEXT, categoria TEXT, fecha_ingreso TEXT, cbu TEXT, sueldo_basico REAL DEFAULT 0, activo INTEGER DEFAULT 1, notas TEXT)`
   - Tabla `liquidaciones (id, empleado_id INTEGER, periodo TEXT, bruto REAL, deducciones REAL, neto REAL, fecha_pago TEXT nullable, estado TEXT DEFAULT 'borrador', notas TEXT)`
   - Pantalla `/rrhh/empleados` + `/rrhh/liquidaciones`
   - Sin cálculo automático de AFIP en esta etapa (→ decisiones-pendientes.md §20)

---

### BLOQUE 4 — IA, ARCA emisión, Minutas
**Integraciones externas y IA. Dependencias externas. Estimado: 4–6 semanas.**

1. **Minutas automáticas** (§24 — ref. tweet bot IA)
   - Pipeline: Google Meet recording sube a Drive → webhook/poll detecta → Claude AI lo transcribe + resume + clasifica (Comercial / Admin / Producción) → guarda en tabla `minutas`
   - Tabla `minutas (id, fecha TEXT, tipo TEXT CHECK(tipo IN ('comercial','admin','produccion')), titulo TEXT, resumen TEXT, participantes TEXT, drive_link TEXT, creado_at TEXT, revisado INTEGER DEFAULT 0)`
   - Pantalla `/minutas`: listado, filtro por tipo, vista detalle, exportar a Word
   - Prerequisito: formato de grabación de Meet en Drive (confirmar con Maricel)

2. **Chatbot IA** (§25)
   - API `/api/chat` con Claude + tool use sobre la DB de ContaFlow
   - Tools: `get_saldo_proveedor`, `get_facturas_pendientes`, `get_saldo_banco`, `get_aging`, etc.
   - Frontend: panel chat lateral (botón flotante en la app)
   - WhatsApp: en fase posterior via Twilio/Meta API (→ decisiones-pendientes.md §21)
   - Sin acceso a datos fuera de ContaFlow

3. **ARCA emisión directa de FE** (§4)
   - Prerequisito: certificado digital del contribuyente + homologación en ambiente de testing AFIP
   - WS: `wsfe` (facturación electrónica) para obtener CAE
   - Pantalla: "Emitir Factura" con previsualización y botón "Enviar a ARCA"
   - Tabla: agregar `cae TEXT`, `cae_vto TEXT`, `emitido_desde_contaflow INTEGER DEFAULT 0` a `facturas_emitidas`
   - Decisión pendiente: ¿se abandona emisión desde Tango en paralelo? (→ decisiones-pendientes.md §22)

---

## 4. Nuevos puntos en decisiones-pendientes.md

Los siguientes puntos se agregarán al archivo durante la implementación:

| # | Punto | Dónde bloquea |
|---|-------|---------------|
| §16 | Tipo de cambio: ¿proporcional (C+V)/2 o solo venta BNA? ¿Actualización diaria automática o manual? | BLOQUE 1 |
| §17 | Impuestos: ¿qué declaraciones se gestionan en ContaFlow vs. Tango? ¿Se generan VEPs desde acá? | BLOQUE 2 |
| §18 | Stock: ¿la empresa vende productos físicos o solo servicios? | BLOQUE 3 |
| §19 | Créditos y Cobranzas: ¿cuántos días de plazo antes de alerta? ¿Se generan recibos firmados digitalmente? | BLOQUE 3 |
| §20 | RRHH: ¿se calculan haberes desde ContaFlow o solo se registran? ¿Integración con AFIP SICOSS? | BLOQUE 3 |
| §21 | Chatbot: ¿WhatsApp en etapa 1 o diferido? ¿Número dedicado o forwarding? | BLOQUE 4 |
| §22 | ARCA emisión: ¿se tiene el certificado digital? ¿Se abandona Tango para FE? | BLOQUE 4 |

---

## 5. Rutas nuevas y convención de nombres

```
/vencimientos          ← existente, agregar vista calendario
/tipo-cambio           ← NUEVO BLOQUE 1
/lote-pagos            ← NUEVO BLOQUE 1
/proveedores           ← existente, ampliar maestro
/facturas-recibidas    ← existente, agregar NDI
/cheques               ← NUEVO BLOQUE 2
/tarjeta-corporativa   ← NUEVO BLOQUE 2
/viaticos              ← NUEVO BLOQUE 2
/fondo-fijo            ← NUEVO BLOQUE 2
/impuestos-servicios   ← NUEVO BLOQUE 2
/comercial/dashboard   ← NUEVO BLOQUE 3
/comercial/acuerdos    ← NUEVO BLOQUE 3
/comercial/comisiones  ← NUEVO BLOQUE 3
/creditos-cobranzas    ← NUEVO BLOQUE 3
/rrhh/empleados        ← NUEVO BLOQUE 3
/rrhh/liquidaciones    ← NUEVO BLOQUE 3
/minutas               ← NUEVO BLOQUE 4
/api/chat              ← NUEVO BLOQUE 4
```

---

## 6. Invariantes que se mantienen

1. Ningún valor impositivo hardcodeado en código — todo en tablas configurables
2. Backup de `contaflow.db` antes de cada migración
3. Migraciones incrementales e idempotentes (función `tryAlter`)
4. Rutas API no exponen `proveedor_id` desde params del cliente
5. `.env.local` para todo lo sensible (tokens ARCA, Twilio, etc.)
6. Al terminar cada bloque: build, resumen de cambios, cómo probarlo, frenar hasta confirmación

---

_Esperando aprobación antes de comenzar la programación._
