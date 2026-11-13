# Decisiones Pendientes — ContaFlow IT Click Video S.A.

_Actualizado: 04/11/2026_

Estos puntos no pueden completarse sin respuesta de la contadora o revisión manual.
Ver también: [`docs/validacion-2025.md`](validacion-2025.md)

---

## 1. Saldos iniciales al 01/01/2025

No se tienen los saldos de apertura por cuenta contable. Faltan:

- **Saldo proveedores** (CxP 2024): total adeudado a cada proveedor al 31/12/2024.
  → Pregunta: ¿Cuánto se le debía a cada proveedor al cierre 2024?
- **Saldo clientes** (CxC 2024): total por cobrar al 31/12/2024.
  → Pregunta: ¿Cuánto debía cada cliente al cierre 2024?
- **Otros saldos iniciales** (impuestos, retenciones a depositar, préstamos, etc.)
  → Estos deberían venir del balance cierre 2024 de Tango.

**Impacto:** Sin saldos iniciales, el Balance de Sumas y Saldos para 2025 no tiene período previo de comparación.

---

## 2. Movimientos de extracto sin cuenta contable (172 casos)

Del extracto Credicoop 2025, **172 movimientos** (mayormente sept–dic 2025) no tienen `cuenta_tango` asignada en la planilla. No se inventó ningún importe.

Pendiente: revisar cada uno en Tango o en la planilla de extracto y asignar la cuenta correspondiente.

**Archivos relacionados:**
- `datos/2025/importar/extracto-credicoop-2025.csv` → columna `cuenta_tango` vacía
- En DB: `SELECT fecha, descripcion, debito, credito FROM extractos_lineas WHERE cuenta_tango='' AND (debito>0 OR credito>0) ORDER BY fecha`

---

## 3. Movimientos con dos cuentas Tango (10 casos)

**10 movimientos** del extracto tienen el campo `cuenta_tango` con dos códigos separados por " y " (ej: `21408 y 42402`). En la DB se guardó la primera cuenta y se marcó `tiene_dos_cuentas=1`.

Pendiente: decidir cómo distribuir el importe entre las dos cuentas para cada movimiento.

**En DB:**
```sql
SELECT fecha, descripcion, debito, credito, cuenta_tango
FROM extractos_lineas WHERE tiene_dos_cuentas=1
```

---

## 4. Nombre de cuenta Tango no encontrado en plan (proveedores sin cuenta_contable_id)

**51 proveedores** tienen `cuenta_tango` en la planilla pero no se pudo resolver a un `id` en `plan_cuentas` (posiblemente el nombre no coincide exactamente).

Pendiente: revisar los nombres en `proveedores.cuenta_tango` vs `plan_cuentas.nombre`.

```sql
SELECT p.razon_social, p.cbu, p.servicio
FROM proveedores p WHERE p.cuenta_contable_id IS NULL AND p.cuit != 'SIN-CUIT-TECSER'
ORDER BY p.razon_social
```

---

## 5. Diferencias con Control_carga_2025.xlsx

El archivo `datos/2025/importar/Control_carga_2025.xlsx` documenta diferencias encontradas al cruzar las fuentes originales. Revisar en conjunto con la contadora.

---

## 6. TECSER — CUIT no disponible

**TECSER** figura en el maestro de proveedores pero sin CUIT ni facturas en 2025. Se insertó con placeholder `SIN-CUIT-TECSER`.

Pendiente: obtener el CUIT correcto y actualizar.

---

## 7. PILAR TAPIA — Proveedor del exterior sin CUIT

**PILAR TAPIA** es un proveedor del exterior (Invoice en USD) sin CUIT argentino. Se insertó con `cuit=''` y `condicion_iva='Del exterior'`.

Los invoices se importaron en moneda USD pero el tipo de cambio que reporta ARCA (y el que figura en el CSV) es 1.0 — verificar si el importe ya está convertido a pesos o hay que registrarlo en USD.

---

## 8. Retenciones de Ganancias — 2025 sin calcular

Las retenciones de Ganancias (SICORE) del ejercicio 2025 se tienen en `datos/2025/impuestos/SICORE/`. **No se calcularon** en esta carga: solo existe el listado de SICORE que presentó la empresa.

Pendiente: confirmar con la contadora si hay que registrar las retenciones sufridas como deducción en el flujo de caja o solo en las DDJJ.

---

## 9. Alícuotas y mínimos de retenciones (Bloque E — 55 preguntas contadora)

La configuración de retenciones (`retenciones_config`) fue preservada del sistema anterior (5 regímenes). Verificar con la contadora que los valores de alícuota, mínimo no imponible y códigos SICORE sean correctos para 2025.

---

## 10. Notas de Crédito — Imputación a factura original

Las notas de crédito (recibidas y emitidas) se importaron como comprobantes independientes. No están imputadas a la factura original que cancelan.

Pendiente: decidir si se quiere imputar NC→factura o mantenerlas sueltas (el saldo de CxP/CxC las considera automáticamente por signo).

---

## 11. Facturas Emitidas en USD

Las facturas emitidas en moneda extranjera usan `tipo_cambio=1.0` según ARCA. Verificar si el importe en la DB está en ARS convertido o en USD nominal.

---

---

## 12. OPs 2025 — 16 pagos a proveedores sin cuenta en sistema

Los siguientes proveedores tienen pagos en `pagos-2025.csv` pero no están en la tabla `proveedores` del sistema. Sus OPs **no fueron importadas** (16 filas):

| CUIT | Nombre | Nro. FCs |
|------|--------|---------|
| 20-32783602-2 | Bajarlia Daniel Adrian | FC 523, 524, 527 |
| 20-24717418-5 | Gallego Rolando Pablo | FC 110, 112 |
| 20-31303247-8 | Bandera Pablo | FC 6 |
| 27-28800457-4 | (Devolución Bandera Pablo) | — |
| 20-17692142-1 | Slusarczuk Eduardo | FC 80 |
| 23-29655189-9 | Costos UCES | FC 99, 100, 102, 105, 106, 108 |
| 20-18445583-9 | Falke Sofia | FC 2, 3, 4 |

Pendiente: confirmar si son proveedores activos del sistema (agregar y re-importar) o pagos fuera del sistema (ej: empleados, gastos directos).

---

## 13. Retenciones SICORE sin OP vinculada (8 certificados)

8 certificados de retención de `retenciones-2025.csv` no tienen Orden de Pago vinculada en el sistema (no aparecen en `pagos-2025.csv`):

| Certificado | Retenido | CUIT | Impuesto |
|------------|---------|------|---------|
| 0000-2025-000033 | Diaz Mario | (sin CUIT) | Ganancias |
| 0000-2025-000027 | Pilo Yamila Natalia | 27-30821026-5 | Ganancias |
| 0000-2025-000032 | Rabinovich Sergio | 20-22962787-3 | Ganancias |
| 0000-2025-000058 | Geo Media SA | 30-70723217-6 | Ganancias |
| 0000-2025-000022 | Artusi Nicolas | (sin CUIT) | Ganancias |
| 0000-2025-000018 | Geo Media SA | 30-70723217-6 | Ganancias |
| 0000-2025-000019 | Pilo Yamila Natalia | 27-30821026-5 | Ganancias |
| 0000-2025-000053 | Kuarzo Arg SA | 30-68847636-0 | Ganancias |

Pendiente: identificar a qué OP corresponde cada certificado y vincularlos manualmente.
Los 2 sin CUIT (Diaz Mario, Artusi Nicolas) también requieren obtener el CUIT.

---

## 14. Saldo CxP al 31/12/2025 — diferencia vs balance

El saldo computado en ContaFlow para facturas recibidas pendientes al 31/12/2025:
- **Pendientes (pagadas en 2026)**: $24,310,777.43 (56 facturas)
- **Sin dato de pago**: $47,538,352.18 (55 facturas — incluye NCs?)
- **Total**: $71,849,129.61

El balance contable reporta **$51,448,632.32** de CxP al 31/12/2025.

Diferencia: ~$20.4M. Posibles causas:
- Las 37 Notas de Crédito ($39,647,194.26 neto) aplican contra facturas "sin dato de pago"
- Facturas marcadas "no pagar según CxP" ($4,315,000) no están en el pasivo

Pendiente: confirmar la composición del saldo CxP en el balance y qué facturas incluye.

---

## 15. Saldo CxC al 31/12/2025 — diferencia vs balance

ContaFlow computa para facturas emitidas pendientes al 31/12/2025:
- **Pendientes (cobradas en 2026)**: 12 facturas
- **Sin dato de cobro**: 12 facturas
- El saldo total pendiente no cierra aún con el balance de $67,788,800.01

Pendiente: confirmar las 12 "sin dato de cobro" (posibles NCs de cancelación).
Caso especial: Factura A 00001-00000236 a LATINA DE GESTION — diferencia de $847,000 con la NC asociada 00001-00000022. Consultar con la contadora.

---

_Las decisiones que tomen en este archivo deben actualizarse borrando el punto o agregando "RESUELTO: [decisión]" al final de cada sección._
