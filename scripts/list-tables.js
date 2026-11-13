const path = require('path');
const { createClient } = require('@libsql/client');
const dbPath = path.resolve(__dirname, '..', 'contaflow.db');
const urlPath = dbPath.replace(/\\/g, '/');
const url = urlPath.startsWith('/') ? 'file:' + urlPath : 'file:/' + urlPath;
const c = createClient({ url });
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .then(r => { r.rows.forEach(r => console.log(r[0])); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
