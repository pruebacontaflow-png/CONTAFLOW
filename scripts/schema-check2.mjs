import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = createClient({ url: `file:/${path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/")}` });
for (const t of ["extractos_bancarios", "facturas_iva_detalle"]) {
  const r = await db.execute(`PRAGMA table_info(${t})`);
  console.log(`\n--- ${t} ---`);
  r.rows.forEach(c => console.log(` ${c.cid} ${c.name} ${c.type}`));
}
db.close();
