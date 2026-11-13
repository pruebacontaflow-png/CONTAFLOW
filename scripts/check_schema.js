const { createClient } = require("@libsql/client");
const path = require("path");
const p = path.resolve("C:/Users/rocio/Documents/contaflow/contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${p}` });
async function main() {
  const tables = ["acuerdos_comerciales", "comisiones", "fondo_fijo_cajas", "fondo_fijo_movimientos", "viaticos", "presupuestos"];
  for (const t of tables) {
    try {
      const r = await db.execute(`PRAGMA table_info(${t})`);
      console.log(`\n=== ${t} ===`);
      r.rows.forEach(row => console.log(`  ${row[1]} ${row[2]}`));
    } catch(e) { console.log(`${t}: NOT FOUND`); }
  }
  // Also count records
  for (const t of ["acuerdos_comerciales", "comisiones", "fondo_fijo_cajas", "fondo_fijo_movimientos"]) {
    try {
      const r = await db.execute(`SELECT COUNT(*) as n FROM ${t}`);
      console.log(`${t}: ${r.rows[0][0]} rows`);
    } catch(e) {}
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
