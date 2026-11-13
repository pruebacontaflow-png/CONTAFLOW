import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = createClient({ url: `file:/${path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/")}` });
for (const t of ["ordenes_pago","ordenes_pago_items","retenciones_aplicadas","retenciones_config","facturas_recibidas","facturas_emitidas"]) {
  const r = await db.execute(`PRAGMA table_info(${t})`);
  console.log(`\n${t} (${r.rows.length}): ${r.rows.map(c=>c.name).join(', ')}`);
}
// Check portal-proveedor route
const ls = await db.execute("SELECT COUNT(*) n FROM usuarios WHERE rol='proveedor'");
console.log('\nusuarios proveedor:', ls.rows[0].n);
db.close();
