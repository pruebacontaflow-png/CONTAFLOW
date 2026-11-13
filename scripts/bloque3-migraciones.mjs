import { createClient } from "@libsql/client";
import { existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../contaflow.db");
const urlPath = dbPath.replace(/\\/g, "/");

// Backup
const ts = new Date().toISOString().replace(/[:\-T]/g, "").slice(0, 12);
const backupPath = join(__dirname, `../contaflow_bloque3_${ts}.db`);
if (existsSync(dbPath)) {
  copyFileSync(dbPath, backupPath);
  console.log("Backup:", backupPath);
}

const db = createClient({ url: `file:/${urlPath}` });

async function run(sql, label) {
  try {
    await db.execute(sql);
    console.log("OK:", label);
  } catch (e) {
    console.error("ERR:", label, e.message);
  }
}

// RRHH: Empleados
await run(`CREATE TABLE IF NOT EXISTS empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  cuit TEXT,
  cuil TEXT,
  cargo TEXT,
  departamento TEXT,
  fecha_ingreso TEXT,
  fecha_egreso TEXT,
  salario_base REAL DEFAULT 0,
  banco TEXT,
  cbu TEXT,
  convenio TEXT,
  categoria TEXT,
  activo INTEGER DEFAULT 1,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "empleados");

// RRHH: Liquidaciones
await run(`CREATE TABLE IF NOT EXISTS liquidaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empleado_id INTEGER NOT NULL REFERENCES empleados(id),
  periodo TEXT NOT NULL,
  salario_bruto REAL DEFAULT 0,
  horas_extra REAL DEFAULT 0,
  bonificaciones REAL DEFAULT 0,
  descuento_jubilacion REAL DEFAULT 0,
  descuento_obra_social REAL DEFAULT 0,
  descuento_sindical REAL DEFAULT 0,
  otros_descuentos REAL DEFAULT 0,
  neto REAL DEFAULT 0,
  estado TEXT DEFAULT 'borrador',
  fecha_pago TEXT,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "liquidaciones");

// Comercial: Acuerdos
await run(`CREATE TABLE IF NOT EXISTS acuerdos_comerciales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER REFERENCES clientes(id),
  descripcion TEXT NOT NULL,
  tipo TEXT DEFAULT 'servicio',
  fecha_inicio TEXT,
  fecha_fin TEXT,
  importe_mensual REAL DEFAULT 0,
  moneda TEXT DEFAULT 'ARS',
  comision_pct REAL DEFAULT 0,
  responsable TEXT,
  estado TEXT DEFAULT 'activo',
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "acuerdos_comerciales");

// Comercial: Comisiones
await run(`CREATE TABLE IF NOT EXISTS comisiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  acuerdo_id INTEGER REFERENCES acuerdos_comerciales(id),
  empleado TEXT NOT NULL,
  periodo TEXT NOT NULL,
  base_calculo REAL DEFAULT 0,
  porcentaje REAL DEFAULT 0,
  importe REAL DEFAULT 0,
  estado TEXT DEFAULT 'pendiente',
  fecha_pago TEXT,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "comisiones");

// CxC: Gestiones de cobranza
await run(`CREATE TABLE IF NOT EXISTS gestiones_cobranza (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factura_id INTEGER NOT NULL REFERENCES facturas_emitidas(id),
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL,
  resultado TEXT,
  notas TEXT NOT NULL,
  proxima_accion TEXT,
  fecha_proxima TEXT,
  usuario TEXT,
  created_at TEXT DEFAULT (datetime('now'))
)`, "gestiones_cobranza");

console.log("BLOQUE 3 migraciones completadas.");
db.close();
