/**
 * Diagnóstico del estado actual de la base de datos ContaFlow.
 * Uso: node scripts/check-db.mjs
 */
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });

const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
console.log("=== TABLAS ===");
console.log(tables.rows.map(r => r.name).join(", "));

const checks = [
  "facturas","proveedores","clientes","asientos","asientos_items",
  "ordenes_pago","ordenes_pago_items","extractos_bancarios",
  "movimientos_bancarios","retenciones_acumulado","periodos",
  "usuarios","plan_cuentas","drive_sync_log","ingesta_pendiente",
  "parametros","audit_log"
];

console.log("\n=== FILAS POR TABLA ===");
for (const t of checks) {
  try {
    const r = await db.execute(`SELECT COUNT(*) as n FROM ${t}`);
    console.log(`  ${t.padEnd(32)} ${r.rows[0].n}`);
  } catch {
    console.log(`  ${t.padEnd(32)} (no existe)`);
  }
}

// Rango de fechas facturas
try {
  const r = await db.execute(
    `SELECT MIN(fecha_emision) min_f, MAX(fecha_emision) max_f, COUNT(*) total FROM facturas`
  );
  const row = r.rows[0];
  console.log(`\n=== FACTURAS (${row.total} total) ===`);
  console.log(`  Rango: ${row.min_f || "(vacío)"} → ${row.max_f || "(vacío)"}`);
  if (Number(row.total) > 0) {
    const tipos = await db.execute(
      `SELECT tipo_operacion, COUNT(*) n FROM facturas GROUP BY tipo_operacion`
    );
    tipos.rows.forEach(r => console.log(`  ${r.tipo_operacion}: ${r.n}`));
  }
} catch (e) { console.log("Error facturas:", e.message); }

// Asientos
try {
  const r = await db.execute(
    `SELECT MIN(fecha) min_f, MAX(fecha) max_f, COUNT(*) total FROM asientos`
  );
  const row = r.rows[0];
  console.log(`\n=== ASIENTOS (${row.total} total) ===`);
  console.log(`  Rango: ${row.min_f || "(vacío)"} → ${row.max_f || "(vacío)"}`);
} catch (e) { console.log("Error asientos:", e.message); }

// Proveedores
try {
  const r = await db.execute(`SELECT COUNT(*) n FROM proveedores`);
  console.log(`\n=== PROVEEDORES: ${r.rows[0].n} ===`);
  if (Number(r.rows[0].n) > 0) {
    const sample = await db.execute(`SELECT razon_social, cuit FROM proveedores LIMIT 5`);
    sample.rows.forEach(p => console.log(`  ${p.cuit} ${p.razon_social}`));
  }
} catch (e) {}

// Períodos
try {
  const r = await db.execute(`SELECT anio, mes, estado FROM periodos ORDER BY anio, mes`);
  console.log(`\n=== PERIODOS (${r.rows.length}) ===`);
  r.rows.forEach(p => console.log(`  ${p.anio}-${String(p.mes).padStart(2,"0")} ${p.estado}`));
} catch {}

// Extractos
try {
  const r = await db.execute(`SELECT COUNT(*) n FROM extractos_bancarios`);
  const m = await db.execute(`SELECT COUNT(*) n FROM movimientos_bancarios`);
  console.log(`\n=== EXTRACTOS: ${r.rows[0].n} archivos, ${m.rows[0].n} movimientos ===`);
} catch {}

// Órdenes de pago
try {
  const r = await db.execute(
    `SELECT MIN(fecha) min_f, MAX(fecha) max_f, COUNT(*) total, SUM(total) suma FROM ordenes_pago`
  );
  const row = r.rows[0];
  console.log(`\n=== ORDENES DE PAGO (${row.total} total) ===`);
  if (Number(row.total) > 0) {
    console.log(`  Rango: ${row.min_f} → ${row.max_f}`);
    console.log(`  Total pagado: $${Number(row.suma || 0).toLocaleString("es-AR")}`);
  }
} catch {}

db.close();
console.log("\nDiagnóstico completo.");
