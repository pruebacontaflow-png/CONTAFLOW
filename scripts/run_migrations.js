// Trigger DB migrations by calling initializeSchema
const path = require("path");
// We need to use the TypeScript-compiled version - let's do migrations directly
const { createClient } = require("@libsql/client");

const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });

async function tryAlter(sql) {
  try { await db.execute(sql); } catch(e) { /* already exists */ }
}

async function main() {
  console.log("Running BLOQUE C migrations...");

  // C.1
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN nro_oc TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN campania TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN precio_texto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN modalidad TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN forma_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN plazo_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN contacto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN archivo_word TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN importe_canje REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN cliente_original TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN comercial_id INTEGER DEFAULT NULL`);
  console.log("✅ C.1 acuerdos_comerciales migrations done");

  // C.2
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN factura_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN coincide_factura INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN pct_cumplimiento REAL DEFAULT NULL`);
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN pct_comision REAL DEFAULT NULL`);
  await db.execute(`CREATE TABLE IF NOT EXISTS comisiones_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descripcion TEXT NOT NULL DEFAULT '',
    pct_comision REAL NOT NULL DEFAULT 0.10,
    reparto_igual INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS comisiones_tramos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pct_cumplimiento_min REAL NOT NULL,
    pct_cumplimiento_max REAL NOT NULL,
    pct_aplicar REAL NOT NULL,
    notas TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS presupuesto_comercial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    cliente_nombre TEXT DEFAULT '',
    periodo TEXT NOT NULL,
    ingresos_proyectados REAL DEFAULT 0,
    ingresos_reales REAL DEFAULT 0,
    gastos_comerciales REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  console.log("✅ C.2 comisiones migrations done");

  // C.3
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN es_retiro_prestamo INTEGER DEFAULT 0`);
  console.log("✅ C.3 fondo_fijo migrations done");

  // C.5
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN archivo_adjunto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN año INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN mes INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN medio_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN caja_mov_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN extracto_linea_id INTEGER DEFAULT NULL`);
  console.log("✅ C.5 viaticos migrations done");

  console.log("\n✅ All BLOQUE C migrations complete");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
