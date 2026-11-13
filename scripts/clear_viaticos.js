const { createClient } = require("@libsql/client");
const path = require("path");
const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });
(async () => {
  const before = await db.execute("SELECT COUNT(*) FROM viaticos");
  await db.execute("DELETE FROM viaticos");
  const after = await db.execute("SELECT COUNT(*) FROM viaticos");
  console.log("Viaticos: antes=" + before.rows[0][0] + ", despues=" + after.rows[0][0]);
})().catch(e => { console.error(e); process.exit(1); });
