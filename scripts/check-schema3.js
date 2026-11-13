const path = require('path');
const { createClient } = require('@libsql/client');
const dbPath = path.resolve(__dirname, '..', 'contaflow.db');
const urlPath = dbPath.replace(/\\/g, '/');
const url = urlPath.startsWith('/') ? 'file:' + urlPath : 'file:/' + urlPath;
const c = createClient({ url });
c.execute("PRAGMA table_info(facturas_recibidas)")
  .then(r => { console.log('facturas_recibidas:', r.rows.map(r => r[1]).join(', ')); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
