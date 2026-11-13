const fs = require("fs");
const path = require("path");
const text = fs.readFileSync(path.resolve(__dirname, "../datos/2025/caja-chica/caja-chica-2025.csv"), "utf-8");

// Use robust CSV parser
function parseCSVFull(text) {
  const headers = [];
  const rows = [];
  let i = 0;
  let header = "";
  while (i < text.length && text[i] !== "\n") { header += text[i++]; }
  i++;
  header.split(",").forEach(h => headers.push(h.trim()));
  while (i < text.length) {
    const fields = [];
    let field = "";
    let inQuote = false;
    while (i < text.length) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuote && text[i+1] === '"') { field += '"'; i += 2; continue; }
        inQuote = !inQuote; i++; continue;
      }
      if (!inQuote && ch === ',') { fields.push(field); field = ""; i++; continue; }
      if (!inQuote && (ch === '\n' || ch === '\r')) {
        if (ch === '\r' && text[i+1] === '\n') i++;
        i++;
        break;
      }
      field += ch; i++;
    }
    fields.push(field);
    if (fields.length >= 4) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = (fields[idx] || "").trim(); });
      rows.push(obj);
    }
  }
  return rows;
}

const rows = parseCSVFull(text);
const glup = rows.filter(r => r.caja && r.caja.includes("Glup"));

let saldo = 0;
console.log("Glup! Streaming rows:");
for (const r of glup) {
  const ing = parseFloat(r.ingreso) || 0;
  const egr = parseFloat(r.egreso) || 0;
  const saldoCSV = parseFloat(r.saldo) || 0;
  const concepto = r.concepto || "";
  const fecha = r.fecha || "";

  const isSaldoInicial = !fecha && !ing && !egr && (concepto.toLowerCase().includes("saldo") || concepto.toLowerCase().includes("inicial"));
  if (isSaldoInicial) { saldo = saldoCSV; console.log(`  INICIAL: ${saldo}`); continue; }

  if (ing === 0 && egr === 0 && !concepto) { console.log(`  SKIP(empty): fecha=${fecha}`); continue; }
  if (!fecha && !concepto) {
    console.log(`  SKIP(no fecha/concepto): ing=${ing} egr=${egr} saldoCSV=${saldoCSV}`);
    continue;
  }

  saldo = saldo + ing - egr;
  const diff = saldoCSV !== 0 ? saldo - saldoCSV : 0;
  const mark = Math.abs(diff) > 1 ? "⚠️ " : "  ";
  console.log(`${mark}${fecha} | ${concepto.substring(0,30)} | ing=${ing} egr=${egr} | calc=${saldo} csv=${saldoCSV}`);
}
console.log(`\nFinal calculado: ${saldo}, Total filas Glup: ${glup.length}`);
