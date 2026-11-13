# Mapa Tango → ContaFlow

Equivalencias funcionales entre Tango Gestión (referencia principal) y SAP Business One (referencia secundaria) con el estado actual de ContaFlow.

> **Criterio de estado:**
> ✅ Implementado | 🔧 Parcial | 📋 Pendiente | ❌ Fuera de scope

---

## 1. Módulos principales

| Tango | SAP B1 | ContaFlow | Estado |
|---|---|---|---|
| Contabilidad General | Contabilidad | Asientos / Plan de Cuentas | ✅ |
| Proveedores (Cuentas a Pagar) | Acreedores | Facturas Recibidas + Órdenes de Pago | ✅ |
| Clientes (Cuentas a Cobrar) | Deudores | Facturas Emitidas | 🔧 |
| Tesorería / Bancos | Gestión de Caja | Bancos + Conciliación + Cash Flow | ✅ |
| Compras | Compras | Ingesta de facturas (manual + Drive) | 🔧 |
| Ventas | Ventas | Facturas Emitidas (básico) | 🔧 |
| Liquidación de Sueldos | RRHH | — | ❌ fuera de scope |
| Activo Fijo | Activos Fijos | — | 📋 |
| Costos / Proyectos | Proyectos | — | 📋 |
| Importaciones | Comercio Exterior | — | ❌ fuera de scope |
| Stock / Inventario | Inventario | — | ❌ fuera de scope |

---

## 2. Contabilidad General

| Función Tango | Función SAP B1 | ContaFlow | Estado | Notas |
|---|---|---|---|---|
| Plan de Cuentas (hasta 8 niveles) | Plan de Cuentas | Plan de cuentas jerárquico | ✅ | |
| Asientos Contables | Asientos diarios | Asientos (debe = haber) | ✅ | Validación $0.01 |
| Asientos automáticos por compra/pago | Contabilización automática | `asientos-auto.ts` | ✅ | |
| Libro Diario | Libro Diario | Export XLSX | ✅ | |
| Libro Mayor | Libro Mayor por cuenta | Export XLSX | ✅ | |
| Balance de Sumas y Saldos | Balance de sumas y saldos | — | 📋 | |
| Balance General | Balance general | — | 📋 | |
| Estado de Resultados | PyG | — | 📋 | |
| Centros de Costo | Centros de beneficio | — | 📋 | |
| Moneda extranjera / tipo de cambio | Multi-moneda | Campo en facturas | 🔧 | Solo almacena; sin recálculo automático |
| Cierre de ejercicio | Cierre de ejercicio | Cierre de período mensual | 🔧 | Solo mensual; cierre anual pendiente |
| Apertura de ejercicio | Saldos iniciales | — | 📋 | |
| Reversiones de asientos | Reversiones | — | 📋 | |
| Notas de ajuste | Partidas de ajuste | — | 📋 | |

---

## 3. Proveedores / Cuentas a Pagar

| Función Tango | ContaFlow | Estado | Notas |
|---|---|---|---|
| ABM de Proveedores | CRUD proveedores | ✅ | |
| Factura de compra (tipo A/B/C/M/E) | Facturas recibidas | ✅ | |
| Nota de Débito / Crédito proveedor | Tipo comprobante en facturas | ✅ | Solo almacena; sin aplicación automática a saldo |
| Cuenta Corriente Proveedor | CC con saldo corrido | ✅ | |
| Orden de Pago | Órdenes de pago con retenciones | ✅ | |
| Pago parcial | Importe parcial por factura | ✅ | |
| Anticipo a proveedor | Modo anticipo en OP | ✅ | |
| Retenciones automáticas | Ganancias, IIBB, SUSS, IVA | ✅ | Alícuotas en tabla configurable |
| Certificado de retención | PDF + numeración secuencial | ✅ | GAN/AGIP/ARBA |
| Acumulado mensual de retenciones | Tabla `retenciones_acumulado` | ✅ | |
| SICORE (exportar retenciones AFIP) | — | 📋 | |
| SIFERE (exportar IIBB) | — | 📋 | |
| Conciliación de facturas | — | 📋 | |
| Importación masiva de facturas | Ingesta CSV + Drive PDF | 🔧 | Drive = solo nuevos |
| Fecha de vencimiento / alertas | Vencimientos con semáforo | ✅ | |

---

## 4. Clientes / Cuentas a Cobrar

| Función Tango | ContaFlow | Estado | Notas |
|---|---|---|---|
| ABM de Clientes | CRUD básico | 🔧 | Sin categorías ni listas de precio |
| Factura de venta | Facturas emitidas | 🔧 | Sin numerador CAE propio |
| Nota de crédito a cliente | — | 📋 | |
| Cuenta corriente cliente | — | 📋 | |
| Cobros / recibos | — | 📋 | |
| Retenciones sufridas | — | 📋 | |
| Cobranza electrónica / débito automático | — | ❌ fuera de scope |

---

## 5. Tesorería / Bancos

| Función Tango | ContaFlow | Estado | Notas |
|---|---|---|---|
| Cuentas bancarias | ABM de bancos | ✅ | |
| Extractos bancarios | Upload de extractos | ✅ | |
| Detección de duplicados en extracto | Hash SHA-256 | ✅ | |
| Conciliación bancaria | Conciliación asistida | ✅ | |
| Reglas de clasificación automática | Reglas por descripción | ✅ | |
| Saldo por cuenta | CC y saldo | ✅ | |
| Proyección de Cash Flow | Dashboard Cash Flow | ✅ | |
| Cheques propios / de terceros | — | 📋 | |
| Transferencias entre cuentas | — | 📋 | |
| Caja chica | — | 📋 | |

---

## 6. Impuestos (módulo crítico Argentina)

| Función Tango | ContaFlow | Estado | Notas |
|---|---|---|---|
| Libro IVA Compras | Libro IVA | ✅ | |
| Libro IVA Ventas | Libro IVA Ventas | 🔧 | Parcial |
| Declaración jurada IVA | — | 📋 | |
| Alícuotas configurables | Tabla `alicuotas_iva` | ✅ | Regla: sin hardcode en código |
| Percepciones/retenciones de IIBB | En facturas y OP | ✅ | |
| Padrón IIBB (AGIP/ARBA) | — | 📋 | Requiere decisión de contadora |
| Regímenes de retención (GAN) | Tabla `regimenes_retencion` | ✅ | |
| Mínimo No Imponible por régimen | En tabla configurable | ✅ | |
| Acumulado mensual para MNI | `retenciones_acumulado` | ✅ | |
| SICORE (archivo AFIP) | — | 📋 | |
| SIFERE | — | 📋 | |
| Bienes Personales / Ganancias empresa | — | ❌ fuera de scope |

---

## 7. Auditoría y control

| Función Tango | ContaFlow | Estado | Notas |
|---|---|---|---|
| Log de acceso por usuario | `audit_log` | ✅ | |
| Historial de cambios por entidad | `audit_log` con valor anterior/nuevo | ✅ | |
| Cierre de período (bloqueo de operaciones) | `checkPeriodoCerrado()` en todos los endpoints | ✅ | |
| Backup automático | `scripts/backup.js` | ✅ | |
| WAL mode / integridad de DB | PRAGMA WAL + busy_timeout | ✅ | |
| Permisos por rol | Admin / Contador | ✅ | Bloque B |
| Permisos granulares por operación | API-level role check | ✅ | |

---

## 8. Reportes

| Reporte Tango | ContaFlow | Estado |
|---|---|---|
| Balance de Sumas y Saldos | — | 📋 |
| Balance General | — | 📋 |
| Estado de Resultados / PyG | — | 📋 |
| Libro Diario | Export XLSX | ✅ |
| Libro Mayor | Export XLSX | ✅ |
| Libro IVA Compras/Ventas | Libro IVA UI | ✅ |
| Cash Flow proyectado | Dashboard Cash Flow | ✅ |
| Cuenta Corriente Proveedor | Modal CC con saldo corrido | ✅ |
| Antigüedad de saldos | — | 📋 |
| Retenciones por período | — | 📋 |
| Conciliación bancaria | Pantalla conciliación | ✅ |

---

## 9. Diferencias terminológicas

| Tango | ContaFlow | Notas |
|---|---|---|
| Proveedor | Proveedor | Igual |
| Cliente | Cliente | Igual |
| Comprobante | Factura / Comprobante | Igual |
| Orden de Pago | Orden de Pago | Igual |
| Recibo | — | No implementado |
| Centro de Costo | — | Pendiente |
| Imputación contable | Asiento automático | Generado al guardar factura/OP |
| Ejercicio | Año fiscal | ContaFlow usa períodos mensuales |
| Período | Período (mes/año) | Igual; cierre bloquea el mes |
| Cuenta contable | Cuenta del plan | Igual |
| Debe / Haber | Debe / Haber | Igual |

---

## 10. Lo que ContaFlow hace diferente a Tango (ventajas de diseño)

| Área | Tango | ContaFlow |
|---|---|---|
| **Valores impositivos** | Hardcodeados en versiones | Todo en tablas configurables; sin valores en código |
| **Retenciones** | Configuración compleja en pantallas | Tabla `regimenes_retencion` editable desde la UI |
| **Importación de facturas** | CSV manual | CSV + Google Drive + Claude AI (PDF) |
| **Acceso** | Usuarios con módulos licenciados | Admin / Contador (roles simples, sin costo por usuario) |
| **Tecnología** | Cliente Windows instalable | Web, corre en cualquier navegador |
| **Backup** | Manual o con agente Tango | Script automático + WAL mode SQLite |
| **Auditoría** | Log interno no exportable | Tabla `audit_log` directamente consultable |
| **Instalación** | Setup complejo, requiere SQL Server | `npm run dev`, base SQLite local |

---

## 11. Prioridades sugeridas para próximas iteraciones

Ordenadas por impacto para el trabajo diario de la contadora:

1. **Balance de Sumas y Saldos** — reporte estándar que se usa mensualmente
2. **SICORE / SIFERE** — exportación obligatoria para AFIP e IIBB
3. **Notas de crédito a proveedores** — aplicación automática al saldo de CC
4. **Cobros y cuenta corriente de clientes** — completar el módulo ventas
5. **Cierre anual** — traspaso de saldos al ejercicio siguiente
6. **Centros de costo** — necesario para separar proyectos/departamentos
7. **Estado de Resultados / Balance General** — reportes contables completos
8. **Cheques** — cartera de cheques propios y de terceros
9. **Padrón IIBB** (AGIP/ARBA) — alícuotas diferenciales automáticas
10. **Caja chica** — movimientos de efectivo

---

## 12. Decisiones pendientes (ver también `docs/decisiones-pendientes.md`)

Estas funcionalidades dependen de las respuestas de la contadora al cuestionario de 55 preguntas:

- Criterio de imputación para notas de crédito (¿reduce saldo de CC o genera asiento inverso?)
- ¿Se emiten facturas electrónicas desde ContaFlow o solo se registran las emitidas en otro sistema?
- ¿Se necesita multi-empresa o siempre es una sola razón social?
- ¿Los cheques recibidos se registran al día del depósito o al día de recepción?
- ¿El cierre de ejercicio requiere asientos de apertura automáticos?
- ¿Se usa algún padrón de IIBB o se aplican alícuotas fijas por jurisdicción?
- ¿Las retenciones de SUSS/ART se calculan sobre qué base?
- ¿Se necesita gestión de anticipos también para clientes (no solo proveedores)?
