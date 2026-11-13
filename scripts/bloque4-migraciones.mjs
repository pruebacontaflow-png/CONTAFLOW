import { createClient } from "@libsql/client";
import { existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../contaflow.db");
const urlPath = dbPath.replace(/\\/g, "/");

// Backup
const ts = new Date().toISOString().replace(/[:\-T]/g, "").slice(0, 12);
const backupPath = join(__dirname, `../contaflow_bloque4_${ts}.db`);
if (existsSync(dbPath)) {
  copyFileSync(dbPath, backupPath);
  console.log("Backup:", backupPath);
}

const db = createClient({ url: `file:/${urlPath}` });

async function run(sql, label) {
  try { await db.execute(sql); console.log("OK:", label); }
  catch (e) { console.error("ERR:", label, e.message); }
}

// Minutas de reunión
await run(`CREATE TABLE IF NOT EXISTS minutas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'reunion',
  titulo TEXT NOT NULL,
  lugar TEXT,
  participantes TEXT,
  descripcion TEXT,
  resoluciones TEXT,
  proximas_acciones TEXT,
  estado TEXT DEFAULT 'borrador',
  responsable TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "minutas");

// ARCA: Lotes de autorización CAE (registro manual)
await run(`CREATE TABLE IF NOT EXISTS arca_lotes_cae (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha_solicitud TEXT NOT NULL,
  punto_venta INTEGER NOT NULL,
  tipo_comprobante TEXT NOT NULL,
  numero_desde INTEGER NOT NULL,
  numero_hasta INTEGER NOT NULL,
  cae TEXT NOT NULL,
  vencimiento_cae TEXT NOT NULL,
  cantidad INTEGER,
  estado TEXT DEFAULT 'vigente',
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "arca_lotes_cae");

// Configuración parámetros ARCA (punto de venta, tipo comprobante default, etc.)
// Se guarda en la tabla parametros existente, no hace falta nueva tabla

// IA: Tabla de consultas guardadas
await run(`CREATE TABLE IF NOT EXISTS consultas_guardadas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  sql_query TEXT NOT NULL,
  tipo_resultado TEXT DEFAULT 'tabla',
  activa INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
)`, "consultas_guardadas");

// Semilla de consultas pre-armadas útiles
const consultas = [
  ["Facturas emitidas pendientes de cobro", "Facturas en estado cobro_pendiente con días de atraso", `SELECT fe.numero, c.razon_social as cliente, fe.fecha_vencimiento, fe.importe_total, CAST(julianday('now') - julianday(fe.fecha_vencimiento) AS INTEGER) as dias_vencido FROM facturas_emitidas fe LEFT JOIN clientes c ON c.id=fe.cliente_id WHERE fe.estado='cobro_pendiente' ORDER BY dias_vencido DESC`, "tabla"],
  ["Saldo por proveedor (CxP)", "Total pendiente de pago agrupado por proveedor", `SELECT p.razon_social, COUNT(*) as cant_facturas, SUM(fr.importe_total) as total_pendiente FROM facturas_recibidas fr LEFT JOIN proveedores p ON p.id=fr.proveedor_id WHERE fr.estado='pendiente_pago' AND (fr.tipo_comprobante NOT LIKE 'Nota de Cr%') GROUP BY fr.proveedor_id ORDER BY total_pendiente DESC`, "tabla"],
  ["Top 10 clientes por facturación", "Clientes con mayor facturación en el período", `SELECT c.razon_social, COUNT(*) as facturas, SUM(fe.importe_total) as total FROM facturas_emitidas fe LEFT JOIN clientes c ON c.id=fe.cliente_id WHERE fe.tipo_comprobante NOT LIKE 'Nota de Cr%' GROUP BY fe.cliente_id ORDER BY total DESC LIMIT 10`, "tabla"],
  ["Top 10 proveedores por compras", "Proveedores con mayor volumen de compras", `SELECT COALESCE(p.razon_social,'INTERNO') as proveedor, COUNT(*) as facturas, SUM(fr.importe_total) as total FROM facturas_recibidas fr LEFT JOIN proveedores p ON p.id=fr.proveedor_id WHERE fr.tipo_comprobante NOT LIKE 'Nota de Cr%' GROUP BY fr.proveedor_id ORDER BY total DESC LIMIT 10`, "tabla"],
  ["Resumen mensual IVA", "IVA débito vs crédito por mes", `SELECT substr(fecha_emision,1,7) as mes, SUM(CASE WHEN tipo='debito' THEN importe_iva ELSE 0 END) as iva_debito, SUM(CASE WHEN tipo='credito' THEN importe_iva ELSE 0 END) as iva_credito FROM (SELECT fecha_emision, importe_iva, 'debito' as tipo FROM facturas_emitidas WHERE importe_iva>0 UNION ALL SELECT fecha_emision, importe_iva, 'credito' as tipo FROM facturas_recibidas WHERE importe_iva>0) GROUP BY mes ORDER BY mes DESC LIMIT 12`, "tabla"],
  ["Cheques en cartera", "Cheques pendientes de depositar o cobrar", `SELECT banco, numero, beneficiario, fecha_cobro, importe FROM cheques WHERE estado='en_cartera' ORDER BY fecha_cobro ASC`, "tabla"],
  ["Vencimientos próximos 30 días", "Facturas por vencer en los próximos 30 días", `SELECT 'CxP' as tipo, COALESCE(p.razon_social,'INTERNO') as contraparte, fr.numero, fr.fecha_vencimiento, fr.importe_total FROM facturas_recibidas fr LEFT JOIN proveedores p ON p.id=fr.proveedor_id WHERE fr.estado='pendiente_pago' AND fr.fecha_vencimiento BETWEEN date('now') AND date('now','+30 days') UNION ALL SELECT 'CxC', COALESCE(c.razon_social,'') as contraparte, fe.numero, fe.fecha_vencimiento, fe.importe_total FROM facturas_emitidas fe LEFT JOIN clientes c ON c.id=fe.cliente_id WHERE fe.estado='cobro_pendiente' AND fe.fecha_vencimiento BETWEEN date('now') AND date('now','+30 days') ORDER BY fecha_vencimiento ASC`, "tabla"],
];

for (const [titulo, desc, sql, tipo] of consultas) {
  const res = await db.execute({ sql: `SELECT id FROM consultas_guardadas WHERE titulo=?`, args: [titulo] });
  if (res.rows.length === 0) {
    await db.execute({ sql: `INSERT INTO consultas_guardadas (titulo, descripcion, sql_query, tipo_resultado) VALUES (?,?,?,?)`, args: [titulo, desc, sql, tipo] });
    console.log("Semilla consulta:", titulo);
  }
}

console.log("BLOQUE 4 migraciones completadas.");
db.close();
