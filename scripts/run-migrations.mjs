/**
 * Ejecuta todas las migraciones de ContaFlow sobre la base de datos existente.
 * Idempotente: se puede correr múltiples veces sin riesgo.
 * Uso: node scripts/run-migrations.mjs
 */
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile   = path.resolve(__dirname, "../contaflow.db");
const backupDir = path.resolve(__dirname, "../backups");

// Backup antes de migrar
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `contaflow-pre-migration-${ts}.db`);
fs.copyFileSync(dbFile, backupPath);
console.log(`Backup creado: ${backupPath}`);

const db = createClient({ url: `file:/${dbFile.replace(/\\/g, "/")}` });

async function tryAlter(sql) {
  try { await db.execute(sql); } catch {}
}

async function run() {
  // WAL mode
  await db.execute("PRAGMA journal_mode=WAL");
  await db.execute("PRAGMA busy_timeout=5000");
  await db.execute("PRAGMA foreign_keys=ON");

  console.log("Aplicando migraciones...");

  // ── Columnas facturas_recibidas ────────────────────────────────────────────
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN comentario_admin TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN cargada_por_proveedor INTEGER DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN punto_venta TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN neto_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN neto_no_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN exento REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN percepcion_iva REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN percepcion_iibb REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN percepcion_otras REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN moneda TEXT DEFAULT 'ARS'`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN tipo_cambio REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN cuit_emisor TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN vencimiento_cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN hash_pdf TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN confianza_extraccion REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN origen TEXT DEFAULT 'manual'`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN motivo_revision TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN drive_file_id TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN drive_url TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN drive_carpeta TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN fecha_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN numero_op TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN comprobante_pago_path TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN certificado_retencion_path TEXT DEFAULT ''`);

  // ── Columnas facturas_emitidas ──────────────────────────────────────────────
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN punto_venta TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN neto_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN neto_no_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN exento REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN percepcion_iva REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN percepcion_iibb REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN percepcion_otras REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN moneda TEXT DEFAULT 'ARS'`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN tipo_cambio REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN cuit_receptor TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN vencimiento_cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN hash_pdf TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN confianza_extraccion REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN origen TEXT DEFAULT 'manual'`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN motivo_revision TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN drive_file_id TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN drive_url TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN drive_carpeta TEXT DEFAULT ''`);

  // ── Columnas periodos_contables ─────────────────────────────────────────────
  await tryAlter(`ALTER TABLE periodos_contables ADD COLUMN cerrado_por TEXT DEFAULT ''`);

  // ── Columnas extractos / bancos / órdenes ──────────────────────────────────
  await tryAlter(`ALTER TABLE extractos_bancarios ADD COLUMN hash_archivo TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE cuentas_bancarias ADD COLUMN config_columnas TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE ordenes_pago ADD COLUMN concepto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE ordenes_pago ADD COLUMN es_anticipo INTEGER DEFAULT 0`);

  // ── Tablas nuevas ──────────────────────────────────────────────────────────
  await db.execute(`CREATE TABLE IF NOT EXISTS retenciones_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    codigo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'ganancias',
    alicuota REAL NOT NULL DEFAULT 0,
    mni REAL NOT NULL DEFAULT 0,
    activo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS ordenes_pago_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_pago_id INTEGER NOT NULL,
    factura_id INTEGER,
    importe REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS retenciones_aplicadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_pago_id INTEGER NOT NULL,
    regimen_id INTEGER,
    nombre TEXT DEFAULT '',
    codigo TEXT DEFAULT '',
    base_calculo REAL DEFAULT 0,
    alicuota REAL DEFAULT 0,
    importe REAL NOT NULL DEFAULT 0,
    numero_certificado TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS plan_cuentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    nivel INTEGER NOT NULL DEFAULT 1,
    padre_id INTEGER,
    activa INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS periodos_contables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'abierto',
    cerrado_en TEXT,
    cerrado_por TEXT DEFAULT '',
    UNIQUE(anio, mes)
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS asientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'manual',
    referencia_tipo TEXT DEFAULT '',
    referencia_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS asientos_lineas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asiento_id INTEGER NOT NULL,
    cuenta_id INTEGER NOT NULL,
    debe REAL NOT NULL DEFAULT 0,
    haber REAL NOT NULL DEFAULT 0,
    descripcion TEXT DEFAULT ''
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS facturas_iva_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id INTEGER NOT NULL,
    tipo_factura TEXT NOT NULL DEFAULT 'recibida',
    alicuota TEXT NOT NULL,
    neto REAL DEFAULT 0,
    iva REAL DEFAULT 0
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS parametros (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL DEFAULT '',
    descripcion TEXT DEFAULT ''
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS extractos_bancarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_id INTEGER NOT NULL,
    nombre_archivo TEXT NOT NULL,
    fecha_subida TEXT DEFAULT (datetime('now')),
    fecha_desde TEXT,
    fecha_hasta TEXT,
    total_movimientos INTEGER DEFAULT 0,
    hash_archivo TEXT DEFAULT ''
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS extractos_lineas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extracto_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    importe REAL NOT NULL DEFAULT 0,
    saldo REAL DEFAULT 0,
    categoria TEXT DEFAULT '',
    conciliado INTEGER DEFAULT 0,
    asiento_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS reglas_clasificacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patron TEXT NOT NULL,
    categoria TEXT NOT NULL,
    cuenta_id INTEGER,
    descripcion TEXT DEFAULT '',
    activa INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL,
    fecha TEXT DEFAULT (datetime('now')),
    accion TEXT NOT NULL,
    entidad_tipo TEXT NOT NULL,
    entidad_id INTEGER,
    valor_anterior TEXT DEFAULT '',
    valor_nuevo TEXT DEFAULT '',
    ip TEXT DEFAULT ''
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS drive_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT DEFAULT (datetime('now')),
    carpeta_id TEXT DEFAULT '',
    carpeta_nombre TEXT DEFAULT '',
    archivos_encontrados INTEGER DEFAULT 0,
    archivos_procesados INTEGER DEFAULT 0,
    archivos_duplicados INTEGER DEFAULT 0,
    archivos_error INTEGER DEFAULT 0,
    duracion_ms INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'ok',
    detalle TEXT DEFAULT '',
    iniciado_por TEXT DEFAULT 'sistema'
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS ingesta_pendiente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_file_id TEXT UNIQUE,
    drive_carpeta TEXT DEFAULT '',
    archivo_nombre TEXT DEFAULT '',
    datos_json TEXT DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente',
    creado_en TEXT DEFAULT (datetime('now'))
  )`);

  // ── Retenciones acumulado (tabla A1) ───────────────────────────────────────
  await db.execute(`CREATE TABLE IF NOT EXISTS retenciones_acumulado (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,
    regimen_id INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    importe_acumulado REAL NOT NULL DEFAULT 0,
    UNIQUE(proveedor_id, regimen_id, anio, mes)
  )`);

  console.log("Migraciones completadas.");

  // Verificar resultado
  const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  console.log(`\nTablas en DB (${tables.rows.length}):`);
  tables.rows.forEach(r => console.log(`  ${r.name}`));

  db.close();
}

run().catch(err => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
