# API de ingesta de comprobantes — ContaFlow

## Endpoint

```
POST /api/ingesta/comprobantes
```

Acepta comprobantes desde sistemas externos (n8n, RPA, scripts).
Autenticación por API key en el header `x-api-key`.

---

## Autenticación

```
x-api-key: <valor de INGESTA_API_KEY en .env.local>
```

Si la key no coincide → `401 Unauthorized`.

---

## Request — multipart/form-data (con PDF adjunto)

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `pdf` | File (application/pdf) | No | El PDF de la factura |
| `data` | string (JSON) | Sí | Metadatos del comprobante (ver abajo) |

O bien los campos del JSON como campos individuales del form.

## Request — application/json (sin PDF)

Body JSON directo con los campos de abajo.

---

## Campos del JSON de metadatos

| Campo | Tipo | Requerido | Ejemplo |
|---|---|---|---|
| `tipo_operacion` | `"compra"` \| `"venta"` | ✅ | `"compra"` |
| `cuit_emisor` | string | Para compras | `"30-71475972-4"` |
| `razon_social_emisor` | string | No | `"IT CLICK VIDEO S.A."` |
| `cuit_receptor` | string | Para ventas | `"30-12345678-9"` |
| `razon_social_receptor` | string | No | `"GCBA"` |
| `tipo_comprobante` | string | ✅ | `"A"` |
| `punto_venta` | string | No | `"0001"` |
| `numero` | string | ✅ | `"00000375"` |
| `fecha_emision` | string (YYYY-MM-DD) | ✅ | `"2025-03-15"` |
| `fecha_vencimiento` | string (YYYY-MM-DD) | No | `"2025-04-15"` |
| `moneda` | string | No (def: `"ARS"`) | `"ARS"` \| `"USD"` |
| `tipo_cambio` | number | No (def: 1) | `1045.50` |
| `neto_gravado` | number | No | `10000.00` |
| `neto_no_gravado` | number | No | `0` |
| `exento` | number | No | `0` |
| `iva_detalle` | array | No | `[{"alicuota":"21%","importe":2100}]` |
| `percepcion_iva` | number | No | `0` |
| `percepcion_iibb` | number | No | `0` |
| `percepcion_otras` | number | No | `0` |
| `total` | number | ✅ | `12100.00` |
| `cae` | string | No | `"73987654321098"` |
| `vencimiento_cae` | string (YYYY-MM-DD) | No | `"2025-03-25"` |
| `drive_file_id` | string | No | `"1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"` |
| `drive_url` | string | No | `"https://drive.google.com/file/d/.../view"` |
| `drive_carpeta` | string | No | `"CXP-2025-03"` |
| `confianza_extraccion` | number (0-1) | No (def: 1) | `0.92` |
| `concepto` | string | No | `"Servicio de fotografía marzo 2025"` |

---

## Respuestas

| `estado` | HTTP | Descripción |
|---|---|---|
| `"creado"` | 201 | Comprobante creado en estado `pendiente_revision` |
| `"requiere_revision"` | 201 | Creado pero requiere revisión manual (CUIT no registrado, aritmética fallida o baja confianza) |
| `"duplicado"` | 200 | Comprobante ya existía; no se creó uno nuevo |
| `"error"` | 500 | Error interno |

### Cuerpo de respuesta

```json
{
  "estado": "creado",
  "id": "42",
  "motivo": null
}
```

```json
{
  "estado": "requiere_revision",
  "id": "43",
  "motivo": "CUIT emisor 30-12345000-0 no registrado (NUEVO PROVEEDOR S.R.L.)"
}
```

```json
{
  "estado": "duplicado",
  "id": "15",
  "motivo": "Comprobante ya registrado (CUIT + tipo + PV + número)"
}
```

---

## Lógica de duplicados (en orden)

1. Si `drive_file_id` ya existe en la base → `duplicado`
2. Si el hash SHA-256 del PDF ya existe → `duplicado`
3. Si ya existe un comprobante con el mismo CUIT + tipo + PV + número → `duplicado`

---

## Lógica de `requiere_revision`

El comprobante queda en `requiere_revision` (visible en la Bandeja de revisión del admin) cuando:

1. CUIT no registrado como proveedor (compra) o cliente (venta)
2. Aritmética no cierra: `neto_gravado + neto_no_gravado + exento + Σ(iva) + Σ(percepciones) ≠ total` (tolerancia $1)
3. `confianza_extraccion < 0.85`

---

## Ejemplo curl — JSON

```bash
curl -X POST https://tu-servidor.com/api/ingesta/comprobantes \
  -H "x-api-key: contaflow-ingesta-2024-cambiar-en-produccion" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_operacion": "compra",
    "cuit_emisor": "20-12345678-9",
    "razon_social_emisor": "Luna Martina",
    "tipo_comprobante": "C",
    "punto_venta": "0001",
    "numero": "00000001",
    "fecha_emision": "2025-03-01",
    "fecha_vencimiento": "2025-03-31",
    "neto_gravado": 0,
    "neto_no_gravado": 50000,
    "exento": 0,
    "iva_detalle": [],
    "total": 50000,
    "confianza_extraccion": 0.97,
    "drive_file_id": "1BxiMVs0abc",
    "drive_url": "https://drive.google.com/file/d/1BxiMVs0abc/view",
    "drive_carpeta": "CXP-2025-03",
    "concepto": "Servicio fotografia marzo"
  }'
```

## Ejemplo curl — multipart (con PDF)

```bash
curl -X POST https://tu-servidor.com/api/ingesta/comprobantes \
  -H "x-api-key: contaflow-ingesta-2024-cambiar-en-produccion" \
  -F "pdf=@/ruta/al/archivo.pdf;type=application/pdf" \
  -F 'data={
    "tipo_operacion": "compra",
    "cuit_emisor": "20-12345678-9",
    "tipo_comprobante": "C",
    "punto_venta": "0001",
    "numero": "00000001",
    "fecha_emision": "2025-03-01",
    "neto_no_gravado": 50000,
    "total": 50000,
    "confianza_extraccion": 0.97
  }'
```

---

## Nodo n8n — estructura del JSON que arma el nodo HTTP Request

En n8n, en el nodo **HTTP Request** configurar:
- **Method**: POST
- **URL**: `https://tu-servidor.com/api/ingesta/comprobantes`
- **Authentication**: Header Auth → `x-api-key: {{ $env.CONTAFLOW_API_KEY }}`
- **Body Content Type**: JSON (si no adjuntás PDF) o Form-Data (con PDF)

Campos a mapear desde el nodo de extracción de IA:

```json
{
  "tipo_operacion": "{{ $json.tipo_operacion }}",
  "cuit_emisor": "{{ $json.cuit_emisor }}",
  "razon_social_emisor": "{{ $json.razon_social_emisor }}",
  "tipo_comprobante": "{{ $json.tipo_comprobante }}",
  "punto_venta": "{{ $json.punto_venta }}",
  "numero": "{{ $json.numero }}",
  "fecha_emision": "{{ $json.fecha_emision }}",
  "fecha_vencimiento": "{{ $json.fecha_vencimiento }}",
  "neto_gravado": "{{ $json.neto_gravado }}",
  "neto_no_gravado": "{{ $json.neto_no_gravado }}",
  "exento": "{{ $json.exento }}",
  "iva_detalle": "{{ JSON.stringify($json.iva_detalle) }}",
  "percepcion_iva": "{{ $json.percepcion_iva }}",
  "percepcion_iibb": "{{ $json.percepcion_iibb }}",
  "percepcion_otras": "{{ $json.percepcion_otras }}",
  "total": "{{ $json.total }}",
  "cae": "{{ $json.cae }}",
  "vencimiento_cae": "{{ $json.vencimiento_cae }}",
  "drive_file_id": "{{ $json.drive_file_id }}",
  "drive_url": "{{ $json.drive_url }}",
  "drive_carpeta": "{{ $json.drive_carpeta }}",
  "confianza_extraccion": "{{ $json.confianza_extraccion }}"
}
```

Variables de entorno en n8n:
- `CONTAFLOW_API_KEY` = valor de `INGESTA_API_KEY` del `.env.local`

---

## Flujo recomendado en n8n para Google Drive

```
Trigger: Google Drive → archivo nuevo en carpetas CXP-*/ventas-*
  ↓
Descargar PDF
  ↓
Nodo IA (Extracto de factura): extraer campos estructurados
  ↓
Nodo HTTP Request: POST /api/ingesta/comprobantes
  ↓
Condición: estado == "requiere_revision" → Notificar al admin
Condición: estado == "duplicado" → Log y continuar
Condición: estado == "creado" → Log OK
```
