const path = require('path');
const { createClient } = require('@libsql/client');
const dbPath = path.resolve(__dirname, '..', 'contaflow.db');
const urlPath = dbPath.replace(/\\/g, '/');
const url = urlPath.startsWith('/') ? 'file:' + urlPath : 'file:/' + urlPath;
const c = createClient({ url });
const tables = ['comisiones', 'lotes_pago', 'lotes_pago_items', 'cheques'];
Promise.all(tables.map(t => c.execute(`PRAGMA table_info(${t})`).then(r => ({ table: t, cols: r.rows.map(r => r[1]) }))))
  .then(results => { results.forEach(r => console.log(r.table + ':', r.cols.join(', '))); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
