// C.3 — Importar movimientos de caja chica desde caja-chica-2025.csv
const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });

const csvPath = path.resolve(__dirname, "../datos/2025/caja-chica/caja-chica-2025.csv");

// Robust CSV parser that handles multiline quoted fields
function parseCSVFull(text) {
  const headers = [];
  const rows = [];
  let i = 0;

  // Parse headers
  let header = "";
  while (i < text.length && text[i] !== "\n") { header += text[i++]; }
  i++; // skip newline
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

// Normalize caja name: "Time Out - Pesos" → "Time Out Pesos"
function normalizeCajaNombre(nombre) {
  return nombre.replace(/\s*-\s*/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  // Load cajas — also build normalized map
  const cajasResult = await db.execute("SELECT id, nombre, moneda FROM fondo_fijo_cajas");
  const cajaMap = {};
  for (const row of cajasResult.rows) {
    const norm = normalizeCajaNombre(String(row[1]).trim());
    cajaMap[norm] = Number(row[0]);
  }
  console.log("Cajas disponibles:", Object.keys(cajaMap));

  const text = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSVFull(text);
  console.log(`Filas leídas del CSV: ${rows.length}`);

  let imported = 0;
  const saldoDiff = {};

  // Process per caja
  const cajasEnCSV = [...new Set(rows.map(r => r.caja).filter(Boolean))];

  for (const cajaNombreCSV of cajasEnCSV) {
    const normalizado = normalizeCajaNombre(cajaNombreCSV);
    const cajaId = cajaMap[normalizado];
    if (!cajaId) {
      console.log(`⚠️  Caja sin match: "${cajaNombreCSV}" → "${normalizado}"`);
      continue;
    }

    const movsCaja = rows.filter(r => r.caja === cajaNombreCSV);

    let saldoCalculado = 0;
    let diffRows = [];
    let primeraVez = true;

    for (const mov of movsCaja) {
      const ing = parseFloat(mov.ingreso) || 0;
      const egr = parseFloat(mov.egreso) || 0;
      const saldoCSV = parseFloat(mov.saldo) || 0;
      const conceptoLower = (mov.concepto || "").toLowerCase();

      // Saldo inicial
      if (primeraVez && (conceptoLower.includes("saldo caja") || conceptoLower.includes("saldo inicial") || conceptoLower.includes("saldo ")) && ing === 0 && egr === 0) {
        saldoCalculado = saldoCSV;
        primeraVez = false;
        await db.execute({ sql: `UPDATE fondo_fijo_cajas SET saldo_actual = ? WHERE id = ?`, args: [saldoCSV, cajaId] });
        console.log(`\n📋 ${cajaNombreCSV} — saldo inicial: ${saldoCSV}`);
        continue;
      }
      primeraVez = false;

      // Skip rows without meaningful data
      if (ing === 0 && egr === 0 && !mov.concepto) continue;
      if (!mov.fecha && !mov.concepto) continue;

      saldoCalculado = saldoCalculado + ing - egr;

      const concepto = mov.concepto || "";
      const esRetiro = /retir|préstamo|prestamo/i.test(concepto);
      const esReposicion = /^repo\s*\.?\s*(cja|caja)/i.test(concepto);
      let tipo = egr > 0 ? "egreso" : "ingreso";

      await db.execute({
        sql: `INSERT INTO fondo_fijo_movimientos (caja_id, fecha, tipo, importe, descripcion, proyecto, area, moneda, saldo_resultante, es_reposicion, es_retiro_prestamo)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          cajaId,
          mov.fecha || "",
          tipo,
          ing > 0 ? ing : egr,
          concepto,
          mov.proyecto || "",
          mov.area || "",
          mov.moneda || "ARS",
          saldoCalculado,
          esReposicion ? 1 : 0,
          esRetiro ? 1 : 0,
        ],
      });
      imported++;

      if (saldoCSV !== 0) {
        const diff = Math.abs(saldoCalculado - saldoCSV);
        if (diff > 1) {
          diffRows.push({ fecha: mov.fecha, concepto, calculado: saldoCalculado, csv: saldoCSV });
        }
      }
    }

    const finalMov = movsCaja.filter(m => parseFloat(m.saldo)).pop();
    const saldoFinalCSV = finalMov ? parseFloat(finalMov.saldo) : 0;
    saldoDiff[cajaNombreCSV] = { calculado: saldoCalculado, csv: saldoFinalCSV, diferencia: saldoCalculado - saldoFinalCSV };

    console.log(`  Movimientos importados: ${movsCaja.length}`);
    if (diffRows.length > 0) {
      console.log(`  ⚠️  ${diffRows.length} diferencias de saldo intermedias`);
      diffRows.slice(0, 3).forEach(d => console.log(`    ${d.fecha} "${d.concepto}": calc=${d.calculado.toFixed(0)} csv=${d.csv.toFixed(0)}`));
    }
  }

  console.log(`\n✅ Total movimientos importados: ${imported}`);
  console.log("\n📊 Resumen de saldos finales:");
  for (const [caja, s] of Object.entries(saldoDiff)) {
    const ok = Math.abs(s.diferencia) < 2;
    console.log(`  ${ok ? "✅" : "⚠️ "} ${caja}: calculado=${s.calculado.toFixed(2)} csv=${s.csv.toFixed(2)} diff=${s.diferencia.toFixed(2)}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
