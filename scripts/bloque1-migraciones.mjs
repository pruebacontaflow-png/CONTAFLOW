/**
 * BLOQUE 1 — Migraciones de BD
 * Agrega: codigo_proveedor, alias_cbu, drive_carpeta a proveedores
 *         es_interna, motivo_interna a facturas_recibidas
 *         tabla tipos_cambio
 *         tabla lotes_pago + lotes_pago_items
 */
import { openDB } from "./dbUtils.mjs";

async function tryAlter(db, table, colDef) {
  try {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
    console.log(`  + ${table}: ${colDef}`);
  } catch (e) {
    if (!e.message?.includes("duplicate column")) console.error(`  ! ${table}: ${colDef} → ${e.message}`);
  }
}

const db = openDB();

console.log("=== BLOQUE 1 — Migraciones ===\n");

// Proveedores
console.log("proveedores:");
await tryAlter(db, "proveedores", "codigo_proveedor TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "alias_cbu TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "drive_carpeta TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "nombre_comercial TEXT DEFAULT ''");

// Facturas recibidas
console.log("facturas_recibidas:");
await tryAlter(db, "facturas_recibidas", "es_interna INTEGER DEFAULT 0");
await tryAlter(db, "facturas_recibidas", "motivo_interna TEXT DEFAULT ''");

// Tipos de cambio
console.log("tipos_cambio:");
await db.execute(`
  CREATE TABLE IF NOT EXISTS tipos_cambio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'USD',
    compra REAL DEFAULT 0,
    venta REAL DEFAULT 0,
    fuente TEXT DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
console.log("  ✓ tipos_cambio creada (o ya existía)");

// Lotes de pago
console.log("lotes_pago:");
await db.execute(`
  CREATE TABLE IF NOT EXISTS lotes_pago (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    fecha TEXT NOT NULL,
    estado TEXT DEFAULT 'borrador',
    creado_por TEXT DEFAULT '',
    total REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`);
console.log("  ✓ lotes_pago creada (o ya existía)");

await db.execute(`
  CREATE TABLE IF NOT EXISTS lotes_pago_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lote_id INTEGER NOT NULL,
    factura_id INTEGER,
    importe REAL DEFAULT 0,
    descripcion TEXT DEFAULT ''
  )
`);
console.log("  ✓ lotes_pago_items creada (o ya existía)");

db.close();
console.log("\n✅ Migraciones BLOQUE 1 aplicadas.");
