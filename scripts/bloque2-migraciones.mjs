/**
 * BLOQUE 2 — Migraciones DB
 * Tablas: cheques, tarjetas_corporativas, gastos_tarjeta,
 *         viaticos, fondo_fijo_movimientos, servicios_recurrentes,
 *         nominas_banco, presupuestos, declaraciones_juradas
 */
import { openDB, backupDB } from "./dbUtils.mjs";

const db = openDB();
backupDB("pre-bloque2");

console.log("\n=== BLOQUE 2 — MIGRACIONES ===\n");

const tablas = [
  {
    name: "cheques",
    sql: `CREATE TABLE IF NOT EXISTS cheques (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      banco TEXT NOT NULL DEFAULT '',
      numero TEXT NOT NULL DEFAULT '',
      fecha_emision TEXT NOT NULL,
      fecha_cobro TEXT DEFAULT '',
      beneficiario TEXT NOT NULL DEFAULT '',
      importe REAL NOT NULL DEFAULT 0,
      estado TEXT DEFAULT 'en_cartera',
      orden_pago_id INTEGER,
      moneda TEXT DEFAULT 'ARS',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "tarjetas_corporativas",
    sql: `CREATE TABLE IF NOT EXISTS tarjetas_corporativas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      banco TEXT NOT NULL DEFAULT '',
      numero_ultimos4 TEXT NOT NULL DEFAULT '',
      titular TEXT NOT NULL DEFAULT '',
      limite REAL DEFAULT 0,
      moneda TEXT DEFAULT 'ARS',
      activa INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "gastos_tarjeta",
    sql: `CREATE TABLE IF NOT EXISTS gastos_tarjeta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tarjeta_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      comercio TEXT NOT NULL DEFAULT '',
      importe REAL NOT NULL DEFAULT 0,
      moneda TEXT DEFAULT 'ARS',
      factura_id INTEGER,
      descripcion TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "viaticos",
    sql: `CREATE TABLE IF NOT EXISTS viaticos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'comida',
      destino TEXT DEFAULT '',
      importe REAL NOT NULL DEFAULT 0,
      moneda TEXT DEFAULT 'ARS',
      comprobante_pdf TEXT DEFAULT '',
      descripcion TEXT DEFAULT '',
      aprobado INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "fondo_fijo_movimientos",
    sql: `CREATE TABLE IF NOT EXISTS fondo_fijo_movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('ingreso','egreso')),
      importe REAL NOT NULL DEFAULT 0,
      descripcion TEXT NOT NULL DEFAULT '',
      comprobante_pdf TEXT DEFAULT '',
      saldo_resultante REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "servicios_recurrentes",
    sql: `CREATE TABLE IF NOT EXISTS servicios_recurrentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT NOT NULL DEFAULT '',
      tipo TEXT NOT NULL DEFAULT 'debito_automatico',
      proveedor_id INTEGER,
      monto REAL DEFAULT 0,
      moneda TEXT DEFAULT 'ARS',
      periodicidad TEXT DEFAULT 'mensual',
      fecha_proximo_vto TEXT DEFAULT '',
      cbu_debito TEXT DEFAULT '',
      estado TEXT DEFAULT 'activo',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "nominas_banco",
    sql: `CREATE TABLE IF NOT EXISTS nominas_banco (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      banco TEXT NOT NULL DEFAULT '',
      fecha TEXT NOT NULL,
      archivo_pdf TEXT DEFAULT '',
      total REAL DEFAULT 0,
      empleados INTEGER DEFAULT 0,
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "presupuestos",
    sql: `CREATE TABLE IF NOT EXISTS presupuestos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area TEXT NOT NULL DEFAULT '',
      periodo TEXT NOT NULL DEFAULT '',
      monto REAL NOT NULL DEFAULT 0,
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
  {
    name: "declaraciones_juradas",
    sql: `CREATE TABLE IF NOT EXISTS declaraciones_juradas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL DEFAULT '',
      periodo TEXT NOT NULL DEFAULT '',
      vep TEXT DEFAULT '',
      monto REAL DEFAULT 0,
      fecha_pago TEXT DEFAULT '',
      extracto_linea_id INTEGER,
      estado TEXT DEFAULT 'pendiente',
      notas TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  },
];

for (const t of tablas) {
  await db.execute(t.sql);
  console.log(`  ✅ ${t.name}`);
}

db.close();
console.log("\n✅ BLOQUE 2 migraciones completas.");
