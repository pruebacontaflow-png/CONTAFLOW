/**
 * Migración BLOQUE A — ejecutar UNA sola vez
 * - A3: Carga proveedores-maestro.csv 2026 (drive carpetas, banco, categoria_arca)
 * - A4: Carga comerciales Leandro Dahlman y Diego Waciarz
 * - A7: Carga producto "Guías Time Out" con movimientos
 * - A8: Carga cajas fondo fijo vacías (saldos iniciales pendientes)
 */
const { createClient } = require("@libsql/client");
const path = require("path");
const fs = require("fs");

const dbPath = path.resolve(process.cwd(), "contaflow.db");
const urlPath = dbPath.replace(/\\/g, "/");
const url = urlPath.startsWith("/") ? `file:${urlPath}` : `file:/${urlPath}`;
const c = createClient({ url });

function parseCsv(text) {
  const lines = text.split("\n").filter(l => l.trim());
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  });
}

async function tryAlter(sql) {
  try { await c.execute(sql); } catch {}
}

async function main() {
  await c.execute("PRAGMA foreign_keys=ON");

  // Crear tablas y columnas nuevas (idempotente)
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN nc_imputa_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN nc_imputa_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN banco TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN categoria_arca TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN caja_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN proyecto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN area TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN moneda TEXT DEFAULT 'ARS'`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN comprobante_numero TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN es_reposicion INTEGER DEFAULT 0`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN op_id INTEGER DEFAULT NULL`);

  await c.execute(`CREATE TABLE IF NOT EXISTS proveedor_drive_carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(proveedor_id, anio)
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS comerciales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    proveedor_id INTEGER,
    zona TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS inversiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'plazo_fijo',
    entidad TEXT DEFAULT '',
    moneda TEXT DEFAULT 'ARS',
    saldo_actual REAL DEFAULT 0,
    tasa_nominal REAL DEFAULT 0,
    fecha_inicio TEXT DEFAULT '',
    fecha_vencimiento TEXT DEFAULT '',
    estado TEXT DEFAULT 'activa',
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS inversion_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inversion_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'deposito',
    importe REAL NOT NULL DEFAULT 0,
    descripcion TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    nombre TEXT NOT NULL,
    unidad TEXT DEFAULT 'unidad',
    stock_actual REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 0,
    observaciones TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS stock_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'egreso',
    cantidad REAL NOT NULL DEFAULT 0,
    stock_resultante REAL DEFAULT 0,
    destino TEXT DEFAULT '',
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS fondo_fijo_cajas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'ARS',
    responsable TEXT DEFAULT '',
    saldo_actual REAL DEFAULT 0,
    activa INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Negar NCs (si aún son positivos)
  await c.execute(`UPDATE facturas_recibidas SET importe_neto = -ABS(importe_neto), importe_iva = -ABS(importe_iva), importe_total = -ABS(importe_total) WHERE tipo_comprobante LIKE 'Nota de Cr%' AND importe_total > 0`);
  await c.execute(`UPDATE facturas_emitidas SET importe_neto = -ABS(importe_neto), importe_iva = -ABS(importe_iva), importe_total = -ABS(importe_total) WHERE tipo_comprobante LIKE 'Nota de Cr%' AND importe_total > 0`);
  const nc_check = await c.execute(`SELECT COUNT(*) FROM facturas_recibidas WHERE tipo_comprobante LIKE 'Nota de Cr%' AND importe_total > 0`);
  console.log(`A1: NCs en FR positivas restantes: ${nc_check.rows[0][0]} (debe ser 0)`);


  // ── A3: Cargar proveedores-maestro 2026 ─────────────────────────────────
  const csvPath = path.resolve(process.cwd(), "datos/2026/importar/proveedores-maestro.csv");
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  let updated = 0, carpetas = 0, notFound = [];

  for (const row of rows) {
    const cuit = row.cuit?.replace(/[^0-9-]/g, "");
    if (!cuit) continue;

    const prov = await c.execute({ sql: "SELECT id FROM proveedores WHERE cuit=?", args: [cuit] });
    if (!prov.rows.length) {
      notFound.push(cuit + " " + row.razon_social);
      continue;
    }
    const id = prov.rows[0][0];

    // Actualizar banco y categoria_arca si hay datos
    const banco = row.banco ?? "";
    const catArca = row.condicion_iva ?? "";
    await c.execute({
      sql: `UPDATE proveedores SET banco=?, categoria_arca=? WHERE id=?`,
      args: [banco, catArca, id],
    });
    updated++;

    // Carpeta Drive 2026
    const link = row.drive_carpeta_2026 ?? "";
    if (link) {
      await c.execute({
        sql: `INSERT OR REPLACE INTO proveedor_drive_carpetas (proveedor_id, anio, link) VALUES (?,2026,?)`,
        args: [id, link],
      });
      carpetas++;
    }
  }
  console.log(`A3: ${updated} proveedores actualizados, ${carpetas} carpetas Drive 2026 cargadas`);
  if (notFound.length) console.log(`  No encontrados (${notFound.length}):`, notFound.slice(0,5).join(" | "));

  // ── A4: Comerciales ──────────────────────────────────────────────────────
  const comerciales = [
    { proveedor_cuit: "20-22964680-0", nombre: "Leandro Dahlman" },
    { proveedor_cuit: "20-21657311-1", nombre: "Diego Waciarz" },
  ];
  for (const com of comerciales) {
    const prov = await c.execute({ sql: "SELECT id FROM proveedores WHERE cuit=?", args: [com.proveedor_cuit] });
    const prov_id = prov.rows.length ? prov.rows[0][0] : null;
    await c.execute({
      sql: `INSERT OR IGNORE INTO comerciales (nombre, proveedor_id, zona, activo) VALUES (?,?,?,1)`,
      args: [com.nombre, prov_id, ""],
    });
  }
  console.log("A4: 2 comerciales cargados (Leandro Dahlman, Diego Waciarz)");

  // ── A7: Producto Guías Time Out + movimientos ────────────────────────────
  const existProd = await c.execute({ sql: "SELECT id FROM productos WHERE codigo='GUIAS-TO'", args: [] });
  let prodId;
  if (!existProd.rows.length) {
    const ins = await c.execute({
      sql: `INSERT INTO productos (codigo, nombre, unidad, stock_actual, observaciones) VALUES ('GUIAS-TO','Guías Time Out','unidad',0,'Guías impresa Time Out Argentina')`,
      args: [],
    });
    prodId = Number(ins.lastInsertRowid);
  } else {
    prodId = Number(existProd.rows[0][0]);
  }

  // Leer CSV de guías
  const guiasCsvPath = path.resolve(process.cwd(), "datos/2025/caja-chica/guias-time-out-2025.csv");
  const guiasRows = parseCsv(fs.readFileSync(guiasCsvPath, "utf8"));

  // Limpiar movimientos existentes del producto
  await c.execute({ sql: "DELETE FROM stock_movimientos WHERE producto_id=?", args: [prodId] });

  let stockActual = 0;
  let movCount = 0;
  for (const r of guiasRows) {
    const fecha = r.fecha || "";
    const ingreso = parseFloat(r.ingreso) || 0;
    const egreso = parseFloat(r.egreso) || 0;
    const stockCsv = parseFloat(r.stock) || 0;
    const destino = r.destino || "";

    if (ingreso > 0) {
      stockActual += ingreso;
      await c.execute({
        sql: `INSERT INTO stock_movimientos (producto_id, fecha, tipo, cantidad, stock_resultante, destino) VALUES (?,?,?,?,?,?)`,
        args: [prodId, fecha || "2025-01-01", "ingreso", ingreso, stockActual, destino],
      });
      movCount++;
    }
    if (egreso > 0) {
      stockActual -= egreso;
      await c.execute({
        sql: `INSERT INTO stock_movimientos (producto_id, fecha, tipo, cantidad, stock_resultante, destino) VALUES (?,?,?,?,?,?)`,
        args: [prodId, fecha || "2025-01-01", "egreso", egreso, stockActual, destino],
      });
      movCount++;
    }
  }

  // Stock inicial (primera fila "Ingresaron" sin fecha = 461)
  const stockFinal = guiasRows.length > 0 ? parseFloat(guiasRows[guiasRows.length - 2]?.stock || guiasRows[guiasRows.length - 1]?.stock || "0") : 0;
  await c.execute({ sql: "UPDATE productos SET stock_actual=? WHERE id=?", args: [stockFinal, prodId] });

  // Verificar que coincide con la planilla
  const csvFinalRow = guiasRows.filter(r => r.stock).pop();
  const csvStock = parseFloat(csvFinalRow?.stock || "0");
  console.log(`A7: Producto cargado (id=${prodId}), ${movCount} movimientos`);
  console.log(`    Stock calculado: ${stockFinal}, Stock CSV: ${csvStock}, ${stockFinal === csvStock ? "✓ COINCIDE" : "⚠ DIFIERE"}`);

  // ── A8: Cajas fondo fijo (vacías, saldos se cargarán con C.3) ───────────
  const cajas = [
    { nombre: "Time Out Pesos", moneda: "ARS", responsable: "" },
    { nombre: "Time Out USD", moneda: "USD", responsable: "" },
    { nombre: "Glup! Streaming USD", moneda: "USD", responsable: "" },
    { nombre: "Control Mari", moneda: "ARS", responsable: "Mari" },
  ];
  for (const caja of cajas) {
    await c.execute({
      sql: `INSERT OR IGNORE INTO fondo_fijo_cajas (nombre, moneda, responsable, saldo_actual, activa) VALUES (?,?,?,0,1)`,
      args: [caja.nombre, caja.moneda, caja.responsable],
    });
  }
  console.log("A8: 4 cajas fondo fijo creadas (saldos a 0, se cargarán con BLOQUE C)");

  console.log("\n✓ Migración BLOQUE A completada");
  process.exit(0);
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
