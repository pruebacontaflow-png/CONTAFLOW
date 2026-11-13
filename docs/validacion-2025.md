# Validación Carga 2025 — IT Click Video S.A.

_Generado: 3/11/2026, 05:39:04_


## 1. Conteos de registros importados
- plan_cuentas: **419** registros
- proveedores: **116** registros
- clientes: **25** registros
- facturas_recibidas: **829** registros
- facturas_emitidas: **158** registros
- extractos_lineas: **1538** registros
- cuentas_bancarias: **1** registros
- ✅ plan_cuentas: 419 = esperado
- ✅ proveedores: 116 = esperado
- ✅ clientes: 25 = esperado
- ✅ facturas_recibidas: 829 = esperado
- ✅ facturas_emitidas: 158 = esperado
- ✅ extractos_lineas: 1538 = esperado

## 2. Plan de Cuentas
- Activo: 143 cuentas
- Resultado negativo: 135 cuentas
- Pasivo: 82 cuentas
- Resultado positivo: 37 cuentas
- Patrimonio neto: 17 cuentas
- Resultados acumulados: 4 cuentas
- Resultado del ejercicio: 1 cuentas
- Sin habilitadas: 1
- Cuentas AXI (ajuste inflación): 208
- ✅ Cuenta Proveedores (21101): encontrada (id 173)
- ✅ Cuenta IVA Crédito Fiscal (11401): encontrada (id 63)
- ✅ Cuenta IVA Débito Fiscal (21401): encontrada (id 212)
- ✅ Cuenta Deudores por Ventas (11301): encontrada (id 52)
- ✅ Cuenta Banco Credicoop (11154): encontrada (id 41)

## 3. Proveedores
- Sin cuenta_contable_id: 52
- Con cuenta_contable_id: 64

## 4. Facturas Recibidas
- Total: 829 facturas, $709.381.183,21
- Pagadas: 728 | Exterior (USD): 13
- ✅ Todas las facturas tienen proveedor
- ARCA CSV recibidos: 817 registros en comprobantes_consulta_csv_recibidos_225210194_30714759724_20261103-1651 (montos expresados en pesos).csv

## 5. Facturas Emitidas
- Total: 158 facturas, $1.057.684.074,96
- Cobradas: 134

## 6. Extracto Bancario Credicoop
- Movimientos: 1538
- Total débitos: $745.039.721,19
- Total créditos: $760.551.886,75
- ⚠️  Sin cuenta_contable_id: 173 (incluye 172 sin cuenta_tango + no resueltos)
- Con dos cuentas Tango: 10 (pendiente de asignación manual)
- ✅ Saldo Credicoop: $23.418.251,19 = esperado

## 7. Movimientos por mes
- 2025-01: 134 mov, saldo min/max: $114.558,74 / $12.399.327,54
- 2025-02: 75 mov, saldo min/max: $592.284,51 / $11.218.744,69
- 2025-03: 95 mov, saldo min/max: $14.138,29 / $14.926.258,93
- 2025-04: 115 mov, saldo min/max: $1.772.678,78 / $27.491.463,86
- 2025-05: 109 mov, saldo min/max: $320.273,28 / $26.993.115,46
- 2025-06: 123 mov, saldo min/max: $2.750.106,86 / $25.906.166,03
- 2025-07: 125 mov, saldo min/max: $739.968,88 / $36.769.598,51
- 2025-08: 174 mov, saldo min/max: $3.028.123,15 / $59.856.073,05
- 2025-09: 162 mov, saldo min/max: $1.328.652,11 / $59.735.947,61
- 2025-10: 148 mov, saldo min/max: $20.748,53 / $53.984.509,04
- 2025-11: 133 mov, saldo min/max: $2.423.654,39 / $52.956.004,72
- 2025-12: 145 mov, saldo min/max: $1.585.203,39 / $48.493.402,62

## 8. Parámetros contables
- ✅ banco_principal_id = id 13 (Banco Credicoop — IT Click)
- ✅ cuenta_banco_principal_id = id 41 (11154 Banco Credicoop)
- ✅ cuenta_clientes_id = id 52 (11301 Deudores por Ventas)
- ✅ cuenta_iva_credito_id = id 63 (11401 Iva Crédito Fiscal)
- ✅ cuenta_iva_debito_id = id 212 (21401 IVA Débito Fiscal)
- ✅ cuenta_proveedores_id = id 173 (21101 Proveedores)
- ✅ cuenta_ret_ganancias_id = id 220 (21410 Ret. Imp a las Ganancias a depositar)
- ✅ cuenta_ret_iibb_id = id 221 (21411 IIBB a pagar)

## 9. Resumen Carga Inicial
- Errores: **0**
- Advertencias: **1**

### Advertencias:
- ⚠️  Sin cuenta_contable_id: 173 (incluye 172 sin cuenta_tango + no resueltos)

---

## 10. Correcciones Post-Carga (04/11/2026)

### PDFs (Ítem 1)
- FR con PDF: **683** de 829 (146 sin PDF)
- FE con PDF: **157** de 158 (1 sin PDF)
- PDFs renombrados a formato `{cuit}_{tipo}_{pv5}_{num8}.{ext}`
- FR con múltiples PDFs (pdf_extra_paths): **5** comprobantes
- Ruta API unificada: `/api/pdf/[...path]` con autenticación. Ruta duplicada `/api/pdfs` eliminada.
- Portal proveedor: **eliminado** (`src/app/portal-proveedor/`)

### Órdenes de Pago 2025 (Ítem 2)
- OPs creadas: **560** (de 576 filas CSV)
- Skipped (proveedor no en sistema): **16** → ver decisiones-pendientes.md §12
- A revisar: **76** OPs (diferencia_sumando_transferencias ≠ 0 o facturas no encontradas)
- Pago a cuenta 2024: **19** OPs
- Retenciones SICORE importadas: **44** certificados
- Retenciones sin OP vinculada: **8** → ver decisiones-pendientes.md §13
- CUITs resueltos por nombre: **5** de 7

### Estado Facturas al 31/12/2025 (Ítems 3 y 4)

**Facturas Recibidas:**
| Estado al 31/12 | Facturas |
|----------------|---------|
| Pagada en 2025 (banco) | 653 |
| Pagada en 2025 (CxP, sin mov bancario) | 26 |
| Pendiente (pagada en 2026) | 55 |
| Pendiente | 1 |
| Sin dato de pago | 55 |
| Nota de crédito (NCs) | 37 |
| No pagar (según CxP) | 2 |
| **Total** | **829** |

Saldo pendiente + sin dato: $71,849,129.61 (balance CxP: $51,448,632.32 → diferencia a confirmar, ver §14)

**Facturas Emitidas:**
| Estado al 31/12 | Facturas |
|----------------|---------|
| Cobrada en 2025 | 120 |
| Pendiente (cobrada en 2026) | 12 |
| Sin dato de cobro | 12 |
| Nota de crédito (NCs) | 12 |
| Fecha con error en CxC | 2 |
| **Total** | **158** |

Saldo pendiente + sin dato (balance CxC: $67,788,800.01 → diferencia a confirmar, ver §15)