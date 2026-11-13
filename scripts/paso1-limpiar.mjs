/**
 * Paso 1: Limpiar datos de prueba
 * - Backup de contaflow.db
 * - Borra todos los datos de prueba
 * - Mantiene usuarios admin/contador y retenciones_config
 */
import { openDB, backupDB } from "./dbUtils.mjs";
import { readdirSync, unlinkSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

backupDB("pre-carga-2025");

const db = openDB();
const deleted = {};

async function del(table, where = "1=1") {
  const r = await db.execute(`SELECT COUNT(*) n FROM ${table} WHERE ${where}`);
  const n = Number(r.rows[0].n);
  if (n > 0) await db.execute(`DELETE FROM ${table} WHERE ${where}`);
  deleted[table] = n;
  console.log(`  ${table}: eliminados ${n}`);
}

console.log("\n=== BORRANDO DATOS DE PRUEBA ===\n");

// Tablas que dependen de facturas / proveedores / clientes (hijas primero)
await del("asientos_lineas");
await del("asientos");
await del("retenciones_aplicadas");
await del("retenciones_acumulado");
await del("ordenes_pago_items");
await del("ordenes_pago");
await del("vencimientos_fiscales");
await del("movimientos_bancarios");
await del("movimientos");
await del("extractos_lineas");
await del("extractos_bancarios");
await del("facturas_iva_detalle");
await del("facturas_recibidas");
await del("facturas_emitidas");
await del("cuentas_bancarias");
await del("clientes");
await del("proveedores");
await del("plan_cuentas");

// Parámetros que apuntan a cuentas del plan de ejemplo
await db.execute(`DELETE FROM parametros WHERE clave NOT LIKE 'drive%'`);
deleted["parametros"] = 1;
console.log("  parametros: borrados (excepto drive)");

// Archivos PDF de prueba en facturas-pdf/
const pdfDir = path.resolve(__dirname, "../facturas-pdf");
let pdfEliminados = 0;
if (existsSync(pdfDir)) {
  for (const f of readdirSync(pdfDir)) {
    if (f !== ".gitkeep") {
      try { unlinkSync(path.join(pdfDir, f)); pdfEliminados++; } catch {}
    }
  }
}
console.log(`  facturas-pdf/: ${pdfEliminados} archivos eliminados`);

// Verificar que se conservan usuarios y retenciones_config
const u = await db.execute("SELECT COUNT(*) n FROM usuarios");
const rc = await db.execute("SELECT COUNT(*) n FROM retenciones_config");
console.log(`\n✅ Conservados: ${u.rows[0].n} usuarios, ${rc.rows[0].n} regímenes retenciones_config`);

// Resumen para docs
console.log("\n=== RESUMEN PARA docs/carga-datos-2025.md ===");
for (const [t, n] of Object.entries(deleted)) {
  if (n > 0) console.log(`- ${t}: ${n} registros`);
}

db.close();
console.log("\n✅ Limpieza completa. Listo para importar datos reales.");
