const { createClient } = require("@libsql/client");
const path = require("path");
const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });
(async () => {
  const r = await db.execute("SELECT empleado, archivo_adjunto FROM viaticos WHERE empleado='Sin asignar'");
  r.rows.forEach(row => console.log(row[0], "->", row[1]));
  console.log("Total sin asignar:", r.rows.length);
})().catch(e => { console.error(e); process.exit(1); });
