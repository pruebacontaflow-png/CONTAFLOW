/**
 * Script de sincronización automática de Google Drive.
 * Corre cada 10 minutos buscando PDFs nuevos en la carpeta configurada.
 *
 * Uso: node scripts/drive-sync.js
 *   o: npm run drive-sync
 */

// Registrar ts-node/esm paths si es necesario; el script corre como CJS
require("dotenv").config({ path: ".env.local" });

const { createClient } = require("@libsql/client");
const { google } = require("googleapis");
const Anthropic = require("@anthropic-ai/sdk");
const path = require("path");
const fs = require("fs");

// ── Config ──────────────────────────────────────────────────────────────────
const DB_PATH    = path.resolve(__dirname, "../contaflow.db");
const TOKEN_PATH = path.resolve(__dirname, "../datos/drive-token.json");
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutos

// ── DB ───────────────────────────────────────────────────────────────────────
const dbUrl = "file:" + DB_PATH.replace(/\\/g, "/");
const db = createClient({ url: dbUrl });

// ── Drive ─────────────────────────────────────────────────────────────────────
function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (!fs.existsSync(TOKEN_PATH)) throw new Error("Token de Drive no encontrado. Conectá primero desde /configuracion-drive");
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
  client.setCredentials(token);
  return client;
}

async function listPdfFiles(folderId, sinceMs) {
  const auth = getOAuth2Client();
  const drive = google.drive({ version: "v3", auth });

  let q = `'${folderId}' in parents and mimeType='application/pdf' and trashed=false`;
  if (sinceMs) {
    const iso = new Date(sinceMs).toISOString();
    q += ` and modifiedTime >= '${iso}'`;
  }

  const resp = await drive.files.list({
    q,
    fields: "files(id, name, modifiedTime, webViewLink)",
    orderBy: "modifiedTime asc",
    pageSize: 100,
  });
  return resp.data.files || [];
}

async function downloadFile(fileId) {
  const auth = getOAuth2Client();
  const drive = google.drive({ version: "v3", auth });
  const resp = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer" });
  return Buffer.from(resp.data);
}

// ── Extractor Claude ──────────────────────────────────────────────────────────
async function extractFromPdf(buffer) {
  const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  const base64 = buffer.toString("base64");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{
      role: "user",
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
        {
          type: "text",
          text: `Sos un extractor de facturas argentinas. Extraé los datos de esta factura en JSON con exactamente estos campos:
{
  "cuit_emisor": "",
  "razon_social_emisor": "",
  "cuit_receptor": "",
  "razon_social_receptor": "",
  "tipo_comprobante": "",
  "punto_venta": 0,
  "numero": 0,
  "fecha_emision": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD",
  "moneda": "ARS",
  "tipo_cambio": 1,
  "neto_gravado": 0,
  "neto_no_gravado": 0,
  "exento": 0,
  "iva_21": 0,
  "iva_10_5": 0,
  "iva_27": 0,
  "percepcion_iva": 0,
  "percepcion_iibb": 0,
  "percepcion_otras": 0,
  "total": 0,
  "cae": "",
  "vencimiento_cae": "YYYY-MM-DD",
  "confianza": 0.95
}
Respondé SOLO con el JSON, sin markdown, sin explicaciones.`,
        },
      ],
    }],
  });

  const text = (msg.content[0]?.text || "")
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(text);
}

// ── Lógica principal de sync ──────────────────────────────────────────────────
async function syncOnce() {
  console.log(`[${new Date().toLocaleString("es-AR")}] Iniciando sincronización...`);

  // Leer config carpeta
  const carpetaRow = await db.execute("SELECT valor FROM parametros WHERE clave='drive_carpeta_id'");
  const carpetaId = carpetaRow.rows[0]?.valor;
  if (!carpetaId) {
    console.log("Sin carpeta configurada. Saltando.");
    return;
  }
  const carpetaNombreRow = await db.execute("SELECT valor FROM parametros WHERE clave='drive_carpeta_nombre'");
  const carpetaNombre = carpetaNombreRow.rows[0]?.valor || carpetaId;

  // Última sync exitosa
  const lastRow = await db.execute(
    "SELECT fecha FROM drive_sync_log WHERE estado IN ('ok','parcial') ORDER BY id DESC LIMIT 1"
  );
  const sinceMs = lastRow.rows[0]?.fecha
    ? new Date(String(lastRow.rows[0].fecha)).getTime() - 60_000
    : undefined;

  const t0 = Date.now();
  const archivos = await listPdfFiles(carpetaId, sinceMs);
  console.log(`  Archivos PDF encontrados: ${archivos.length}`);

  let procesados = 0, duplicados = 0, errores = 0;
  const detalle = [];

  for (const file of archivos) {
    try {
      console.log(`  → ${file.name}`);
      const buffer = await downloadFile(file.id);
      const datos  = await extractFromPdf(buffer);

      // Verificar duplicado por CAE o hash drive_file_id
      if (datos.cae) {
        const dup = await db.execute(
          "SELECT id FROM facturas WHERE cae=? LIMIT 1",
          [datos.cae]
        );
        if (dup.rows.length > 0) {
          duplicados++;
          detalle.push({ file: file.name, estado: "duplicado" });
          console.log(`     duplicado (CAE ${datos.cae})`);
          continue;
        }
      }

      // Insertar factura simplificada (sin proveedor_id = sync no puede resolver proveedor)
      // La ingesta completa requiere el módulo Next.js; aquí se guarda para revisión manual
      await db.execute(
        `INSERT INTO ingesta_pendiente (
           drive_file_id, drive_carpeta, archivo_nombre,
           datos_json, estado, creado_en
         ) VALUES (?, ?, ?, ?, 'pendiente', datetime('now'))
         ON CONFLICT(drive_file_id) DO NOTHING`,
        [file.id, carpetaNombre, file.name, JSON.stringify(datos)]
      );

      procesados++;
      detalle.push({ file: file.name, estado: "pendiente" });
      console.log(`     OK → ingesta_pendiente`);
    } catch (err) {
      errores++;
      detalle.push({ file: file.name, estado: "error", motivo: String(err?.message || err) });
      console.error(`     ERROR: ${err.message}`);
    }
  }

  const duracion_ms = Date.now() - t0;

  await db.execute(
    `INSERT INTO drive_sync_log
       (carpeta_id, carpeta_nombre, archivos_encontrados, archivos_procesados,
        archivos_duplicados, archivos_error, duracion_ms, estado, detalle, iniciado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      carpetaId, carpetaNombre,
      archivos.length, procesados, duplicados, errores,
      duracion_ms,
      errores > 0 ? "parcial" : "ok",
      JSON.stringify(detalle),
      "cron",
    ]
  );

  console.log(`  Completado: ${procesados} procesados, ${duplicados} dup, ${errores} errores (${(duracion_ms/1000).toFixed(1)}s)\n`);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

// Crear tabla ingesta_pendiente si no existe (fallback si la migración no corrió)
db.execute(`
  CREATE TABLE IF NOT EXISTS ingesta_pendiente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_file_id TEXT UNIQUE,
    drive_carpeta TEXT,
    archivo_nombre TEXT,
    datos_json TEXT,
    estado TEXT DEFAULT 'pendiente',
    creado_en TEXT DEFAULT (datetime('now'))
  )
`).then(() => {
  // Primera ejecución inmediata
  syncOnce().catch(console.error);

  // Luego cada 10 minutos
  setInterval(() => syncOnce().catch(console.error), INTERVAL_MS);

  console.log(`Script de sync iniciado. Próxima corrida en ${INTERVAL_MS / 60000} minutos.`);
  console.log("Presioná Ctrl+C para detener.\n");
}).catch(err => {
  console.error("Error al iniciar:", err.message);
  process.exit(1);
});
