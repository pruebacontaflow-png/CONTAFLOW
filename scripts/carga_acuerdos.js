// C.1 — Importar acuerdos comerciales desde acuerdos-comerciales-2025.csv
const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });

const csvPath = path.resolve(__dirname, "../datos/2025/comercial/acuerdos-comerciales-2025.csv");

function parseCSV(text) {
  const lines = text.split("\n");
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(line => {
    // Simple CSV parse (fields may contain commas inside quotes)
    const fields = [];
    let current = "";
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    fields.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (fields[i] || "").replace(/^"|"$/g, "").trim(); });
    return obj;
  });
}

async function main() {
  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(text);

  // Load all clients for matching
  const clientes = await db.execute("SELECT id, razon_social FROM clientes");
  const clienteMap = {};
  for (const row of clientes.rows) {
    const nombre = String(row[1]).toLowerCase().trim();
    clienteMap[nombre] = Number(row[0]);
  }

  function findCliente(nombre) {
    if (!nombre) return null;
    const n = nombre.toLowerCase().trim();
    // Exact match
    if (clienteMap[n]) return clienteMap[n];
    // Partial match
    for (const [key, id] of Object.entries(clienteMap)) {
      if (key.includes(n) || n.includes(key)) return id;
    }
    return null;
  }

  let imported = 0;
  let unmatched = [];

  for (const row of rows) {
    const clienteId = findCliente(row.cliente);
    if (!clienteId) {
      unmatched.push({ archivo: row.archivo, cliente: row.cliente, cliente_segun_archivo: row.cliente_segun_archivo });
    }

    const importe = parseFloat(row.importe) || 0;
    // Detect canje from modalidad
    let importeCanje = 0;
    let importeCash = importe;
    if (row.modalidad && row.modalidad.toLowerCase().includes("canje")) {
      importeCanje = importe * 0.5;
      importeCash = importe * 0.5;
    } else if (row.modalidad && row.modalidad.toLowerCase().includes("voucher")) {
      importeCanje = importe * 0.5;
      importeCash = importe * 0.5;
    }

    await db.execute({
      sql: `INSERT INTO acuerdos_comerciales
        (cliente_id, descripcion, tipo, fecha_inicio, fecha_fin, importe_mensual, moneda,
         estado, notas, nro_oc, campania, precio_texto, modalidad, forma_pago, plazo_pago,
         contacto, archivo_word, importe_canje, cliente_original)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        clienteId || null,
        row.campania || row.cliente_segun_archivo || row.cliente || "",
        "acuerdo",
        row.inicio || "",
        row.fin || "",
        importeCash,
        row.iva && row.iva.toLowerCase().includes("iva") ? "ARS+IVA" : "ARS",
        "activo",
        "",
        row.nro_oc || "",
        row.campania || "",
        row.precio_texto || "",
        row.modalidad || "",
        row.forma_pago || "",
        row.plazo_pago || "",
        row.contacto || "",
        row.archivo || "",
        importeCanje,
        row.cliente || "",
      ],
    });
    imported++;
  }

  console.log(`\n✅ Acuerdos importados: ${imported}`);
  console.log(`\n⚠️  Sin cliente asociado (${unmatched.length}):`);
  unmatched.forEach(u => {
    console.log(`  - "${u.cliente}" (archivo: ${u.archivo})`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });
