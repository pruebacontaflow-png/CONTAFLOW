# Conexión Google Drive — ContaFlow

Guía de configuración para integrar Google Drive con la importación automática de facturas PDF.

---

## 1. Crear credenciales en Google Cloud Console

1. Ir a [https://console.cloud.google.com](https://console.cloud.google.com)
2. Crear un proyecto nuevo (ej.: `contaflow-itclick`) o usar uno existente
3. Activar la **Google Drive API**:
   - Menu → APIs & Services → Library → buscar "Google Drive API" → Enable
4. Crear credenciales OAuth 2.0:
   - Menu → APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID
   - Application type: **Web application**
   - Nombre: `ContaFlow local`
   - Authorized redirect URIs: `http://localhost:3000/api/drive/callback`
   - Copiar el **Client ID** y el **Client Secret**

---

## 2. Configurar `.env.local`

```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/drive/callback
GOOGLE_ACCOUNT_HINT=info@itclickmedia.com
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

> El archivo `.env.local` nunca se sube a git (está en `.gitignore`).

---

## 3. Conectar la cuenta de Google desde la UI

1. Iniciar ContaFlow con `npm run dev`
2. Iniciar sesión como **admin**
3. Ir a **Configuración → Google Drive** (menú lateral)
4. Hacer clic en **"Conectar con Google"**
5. Se abre la pantalla de consentimiento de Google → seleccionar la cuenta `info@itclickmedia.com`
6. Aceptar los permisos (solo lectura de Drive)
7. ContaFlow guarda el token en `datos/drive-token.json` (excluido de git)

---

## 4. Elegir la carpeta de facturas

1. En la página de configuración, hacer clic en **"Elegir carpeta"**
2. Navegar por las carpetas del Drive de `info@itclickmedia.com`
3. Seleccionar la carpeta que contiene los PDFs de facturas de proveedores
4. Hacer clic en **"Usar esta carpeta"**

---

## 5. Sincronización manual

Desde la página de configuración, el botón **"Sincronizar ahora"** procesa solo los archivos nuevos desde la última sincronización exitosa.

---

## 6. Sincronización automática (cada 10 minutos)

El script `scripts/drive-sync.js` corre en un proceso Node.js separado con un `setInterval` de 10 minutos.

**Iniciar:**
```bash
npm run drive-sync
```

**Mantener corriendo en producción** (Windows):
```batch
:: Opción A — ventana CMD visible
start "ContaFlow Drive Sync" node scripts/drive-sync.js

:: Opción B — Task Scheduler (ejecutar en arranque del sistema)
:: Acción: node.exe   Argumentos: C:\ruta\contaflow\scripts\drive-sync.js
```

---

## 7. Cómo funciona la extracción

1. **Drive** → se listan PDFs nuevos o modificados en la carpeta configurada
2. **Descarga** → el PDF se baja como buffer en memoria (nunca se guarda en disco)
3. **Claude AI** → el PDF se envía a `claude-sonnet-4-6` con un prompt estructurado
4. **Resultado** → se parsea el JSON con todos los campos del comprobante argentino:
   - CUIT emisor/receptor, tipo de comprobante, punto de venta, número
   - Fechas, moneda, tipo de cambio
   - Neto gravado, IVA 21%/10.5%/27%, percepciones, total
   - CAE y vencimiento de CAE
5. **Ingesta** → se llama a `procesarIngesta()` que:
   - Detecta duplicados por hash SHA-256 del PDF
   - Busca o crea el proveedor por CUIT
   - Crea la factura en la base de datos
   - Genera el asiento automático

> El script standalone guarda en `ingesta_pendiente` (tabla de revisión); el endpoint `/api/drive/sync` ejecuta la ingesta completa.

---

## 8. Token de Drive

- Ruta: `datos/drive-token.json`
- Contiene: `access_token`, `refresh_token`, `expiry_date`, `token_type`
- Google renueva automáticamente el `access_token` usando el `refresh_token`
- Para revocar el acceso: botón "Desconectar" en la UI, o eliminar el archivo manualmente

---

## 9. Seguridad

| Elemento | Ubicación | Git |
|---|---|---|
| Credenciales OAuth | `.env.local` | ❌ excluido |
| Token de Drive | `datos/drive-token.json` | ❌ excluido |
| Facturas PDF | Solo en memoria durante el procesamiento | — |
| API Key Anthropic | `.env.local` | ❌ excluido |
| Base de datos | `contaflow.db` | ❌ excluido |

---

## 10. Solución de problemas

| Problema | Solución |
|---|---|
| "Token de Drive no encontrado" | Reconectar desde la UI: /configuracion-drive |
| "Error 403: access_denied" | Verificar que la cuenta tenga permisos en la carpeta |
| "JSON parse error" en extracción | El PDF podría estar corrupto o no ser una factura válida |
| "Drive no conectado" en API | El token expiró sin refresh; desconectar y reconectar |
| El script falla al arrancar | Verificar que `datos/drive-token.json` exista y `.env.local` tenga las variables |
