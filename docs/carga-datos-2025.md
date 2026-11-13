# Carga y Validación de Datos 2025

Guía paso a paso para cargar todos los datos reales de 2025 en ContaFlow para IT Click Video S.A. (CUIT 30-71475972-4).

---

## ✅ CARGA COMPLETADA — 03/11/2026

### Datos eliminados (Paso 1 — prueba)
| Tabla | Registros eliminados |
|---|---|
| plan_cuentas | 33 (cuentas de ejemplo) |
| proveedores | 8 (test) |
| clientes | 5 (test) |
| facturas_recibidas | 13 (test) |
| facturas_emitidas | 10 (test) |
| cuentas_bancarias | 4 (test) |
| vencimientos_fiscales | 10 (test) |
| parametros | todos (excepto drive) |

Conservados: usuarios admin/contador, retenciones_config (5 regímenes).

### Datos importados (Paso 3)
| Dato | Registros | Fuente | Notas |
|---|---|---|---|
| Plan de cuentas | 419 | plan-cuentas-tango.csv | Incluve 208 AXI |
| Proveedores | 116 | proveedores.csv | 51 sin cuenta_contable_id |
| Clientes | 25 | clientes.csv | — |
| Cuenta Credicoop | 1 | manual | Saldo inicial $7.906.085,63 |
| Facturas recibidas | 829 | facturas-recibidas.csv | 678 PDFs copiados |
| Facturas emitidas | 158 | facturas-emitidas.csv | 157 PDFs copiados |
| Extracto bancario | 1.538 | extracto-credicoop-2025.csv | Saldo final $23.418.251,19 ✅ |

### Parámetros configurados
| Clave | Código Tango | Cuenta |
|---|---|---|
| cuenta_proveedores_id | 21101 | Proveedores |
| cuenta_iva_credito_id | 11401 | IVA Crédito Fiscal |
| cuenta_iva_debito_id | 21401 | IVA Débito Fiscal |
| cuenta_clientes_id | 11301 | Deudores por Ventas |
| cuenta_banco_principal_id | 11154 | Banco Credicoop |
| cuenta_ret_ganancias_id | 21410 | Ret. Ganancias a depositar |
| cuenta_ret_iibb_id | 21411 | IIBB a pagar |

### Pendientes (ver docs/decisiones-pendientes.md)
- 172 movimientos extracto sin cuenta_tango asignada
- 10 movimientos con dos cuentas Tango
- 51 proveedores sin cuenta_contable_id resuelta
- Saldos de apertura al 01/01/2025 (CxP y CxC 2024)
- TECSER: sin CUIT (placeholder)
- PILAR TAPIA: proveedor exterior sin CUIT argentino

---

## Paso 1 — Correr migraciones (ya realizado)

```bash
npm run migrations
```

Crea todas las tablas y columnas nuevas. Es idempotente: hace backup automático antes de correr.

---

## Paso 2 — Verificar estado actual

```bash
npm run validar
```

Muestra errores y advertencias sobre la integridad de los datos.

---

## Paso 3 — Preparar archivos de datos

Guardar los archivos reales en `datos/2025/` (excluida de git).

```
datos/
  2025/
    proveedores.csv          ← Lista de proveedores reales
    facturas-recibidas.csv   ← Facturas de compra del año
    facturas-emitidas.csv    ← Facturas de venta del año (si aplica)
    extractos/
      banco-galicia-ene.csv
      banco-galicia-feb.csv
      ...
```

Ver plantillas en `docs/plantillas/` para el formato correcto.

---

## Paso 4 — Importar proveedores

```bash
# Ver formato esperado
npm run importar:proveedores -- --ejemplo

# Importar
npm run importar:proveedores -- datos/2025/proveedores.csv
```

El script actualiza si el CUIT ya existe, o inserta si es nuevo.

**Campos del CSV:**
```
cuit, razon_social, condicion_iva, direccion, telefono, email, contacto
```

---

## Paso 5 — Importar facturas recibidas

```bash
# Ver formato esperado
npm run importar:facturas -- --ejemplo

# Importar
npm run importar:facturas -- datos/2025/facturas-recibidas.csv
```

El script detecta duplicados por: `cuit_emisor + tipo_comprobante + punto_venta + numero`.
Si el proveedor no existe, se crea automáticamente con datos mínimos.

**Campos del CSV:**
```
cuit_emisor, razon_social_emisor, tipo_comprobante, punto_venta, numero,
fecha_emision, fecha_vencimiento, neto_gravado, iva_21, iva_10_5, iva_27,
percepcion_iva, percepcion_iibb, percepcion_otras, total, cae, concepto
```

> Alternativamente: usar la importación desde Google Drive (PDFs) — ver `docs/conexion-google-drive.md`.

---

## Paso 6 — Importar extractos bancarios

```bash
# Ver cuentas bancarias disponibles
npm run importar:extractos -- --cuentas

# Importar un extracto (reemplazar 1 con el ID de cuenta)
npm run importar:extractos -- 1 datos/2025/extractos/banco-ene.csv
```

El script:
- Detecta duplicados por hash SHA-256 del archivo (no importa el mismo archivo dos veces)
- Autodetecta formato `debito/credito` o `importe`
- Acepta fechas `DD/MM/YYYY` o `YYYY-MM-DD`
- Actualiza el saldo de la cuenta con el último saldo del extracto

---

## Paso 7 — Cargar facturas desde Google Drive (alternativa al CSV)

Si los PDFs de facturas están en Drive:

1. Conectar cuenta desde `/configuracion-drive`
2. Elegir la carpeta donde están los PDFs
3. Hacer clic en "Sincronizar ahora"
4. ContaFlow usa Claude AI para extraer los datos de cada PDF automáticamente

---

## Paso 8 — Cargar órdenes de pago

Las órdenes de pago se cargan desde la UI en `/ordenes-pago`. No hay importación CSV actualmente porque requieren:
- Asociar facturas específicas
- Calcular retenciones en tiempo real
- Número de cheque o transferencia

Cargar manualmente cada orden de pago registrada en 2025.

---

## Paso 9 — Verificar plan de cuentas

Ir a `/plan-cuentas` y verificar que las cuentas coincidan con las que usa la empresa. El plan actual tiene 33 cuentas.

Si faltan cuentas, agregarlas desde la UI antes de cargar asientos manuales.

---

## Paso 10 — Proveedor pendiente de identificar

La factura ID 31 tiene un proveedor provisional creado (ID 25) con CUIT `20-12345678-9`.
El `motivo_revision` indica: "Luna Martina".

Ir a `/proveedores`, encontrar el proveedor con razón social "PROVEEDOR PENDIENTE IDENTIFICAR" y completar los datos reales.

---

## Paso 11 — Desactivar usuario proveedor

Hay un usuario con `rol='proveedor'` todavía activo (del sistema anterior).
Ir a `/usuarios` → desactivar.

---

## Paso 12 — Validación final

```bash
npm run validar
```

El objetivo es llegar a: **0 errores, 0 advertencias** (o solo advertencias justificadas como "sin facturas emitidas" si la empresa no factura).

---

## Scripts de utilidad disponibles

| Script | Comando | Descripción |
|---|---|---|
| Migraciones | `npm run migrations` | Aplica todas las migraciones (idempotente) |
| Estado DB | `npm run check-db` | Diagnóstico rápido de filas por tabla |
| Validación | `npm run validar` | Reporte completo de integridad |
| Importar proveedores | `npm run importar:proveedores -- <csv>` | Carga/actualiza proveedores desde CSV |
| Importar facturas | `npm run importar:facturas -- <csv>` | Importa facturas recibidas desde CSV |
| Importar extractos | `npm run importar:extractos -- <id> <csv>` | Importa movimientos bancarios desde CSV |
| Backup | `npm run backup` | Backup manual de la DB |
| Drive sync | `npm run drive-sync` | Sync automático cada 10 min |

---

## Qué NO está automatizado todavía

- Importación de facturas emitidas en CSV (usar UI o Drive)
- Carga de órdenes de pago pasadas (usar UI)
- Carga de asientos manuales del historial (usar UI `/asientos`)
- Conciliación bancaria de extractos históricos (usar UI `/conciliacion`)
