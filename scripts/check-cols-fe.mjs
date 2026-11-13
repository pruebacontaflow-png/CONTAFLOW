import { createClient } from "@libsql/client";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });
const r = await db.execute("PRAGMA table_info(facturas_emitidas)");
console.log(r.rows.map(c => c.name).join(", "));
db.close();
