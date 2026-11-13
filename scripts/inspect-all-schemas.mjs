import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = createClient({ url: `file:/${path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/")}` });
const tables = ["plan_cuentas","proveedores","clientes","facturas_recibidas","facturas_emitidas","extractos_lineas","cuentas_bancarias","parametros"];
for (const t of tables) {
  console.log(`\n--- ${t} ---`);
  const r = await db.execute(`PRAGMA table_info(${t})`);
  r.rows.forEach(c => console.log(` ${c.name}  ${c.type}  default=${c.dflt_value}`));
}
// Conteo de datos actuales (test data)
console.log("\n=== DATOS ACTUALES ===");
for (const t of ["proveedores","clientes","facturas_recibidas","facturas_emitidas","plan_cuentas","cuentas_bancarias","ordenes_pago","retenciones_config"]) {
  const r = await db.execute(`SELECT COUNT(*) n FROM ${t}`);
  console.log(` ${t}: ${r.rows[0].n}`);
}
db.close();
