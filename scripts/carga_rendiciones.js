// C.5 — Importar rendiciones de gastos desde datos/rendiciones/
const { createClient } = require("@libsql/client");
const fs = require("fs");
const path = require("path");

const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });

const BASE = path.resolve(__dirname, "../datos/rendiciones/06. Rendiciones Caja Chica - Maricel  y Rocío");

// Map all naming variants to canonical names
const PERSONA_MAP = {
  "dahlman": "Leandro Dahlman", "dalhman": "Leandro Dahlman", "leandro": "Leandro Dahlman",
  "pitocco": "Maricel Pitocco", "maricel": "Maricel Pitocco",
  "spina": "Rocío Spina", "rocio": "Rocío Spina", "rocío": "Rocío Spina",
  "armocida": "Damian Armocida", "damian": "Damian Armocida",
  "petraglia": "Mariana Petraglia", "mariana": "Mariana Petraglia",
  "waciarz": "Diego Waciarz", "diego": "Diego Waciarz",
  "vallejos": "Soledad Vallejos",
};

function normalizaPersona(str) {
  const low = str.toLowerCase().replace(/\s+/g, " ").trim();
  for (const [key, canonical] of Object.entries(PERSONA_MAP)) {
    if (low.includes(key)) return canonical;
  }
  return null;
}

function extractPersona(fileName, dirPath) {
  const parts = dirPath.split(/[/\\]/);
  // Look for person directory — any part with 2+ words (not year, not month)
  for (const p of parts) {
    if (/^\d{4}$/.test(p)) continue; // skip years
    if (/^\d/.test(p)) continue; // skip date-like entries
    const candidate = normalizaPersona(p);
    if (candidate) return candidate;
  }
  // From file name
  const candidate = normalizaPersona(fileName);
  if (candidate) return candidate;
  return "Sin asignar";
}

function extractYear(dirPath) {
  const m = dirPath.match(/\b(2025|2026)\b/);
  return m ? parseInt(m[1]) : null;
}

function extractMonth(dirPath, fileName) {
  const meses = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  const combined = (dirPath + " " + fileName).toLowerCase();
  for (const [nombre, num] of Object.entries(meses)) {
    if (combined.includes(nombre)) return num;
  }
  return null;
}

function extractMedioPago(fileName) {
  const f = fileName.toLowerCase();
  if (f.includes("cash") || f.includes("efectivo")) return "cash";
  if (f.includes("transf") || f.includes("transferencia")) return "transferencia";
  return "";
}

function walkDir(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full, results);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if ([".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls"].includes(ext)) {
        results.push({ file: full, name: e.name, dir });
      }
    }
  }
  return results;
}

async function main() {
  if (!fs.existsSync(BASE)) {
    console.log("❌ Directorio no encontrado:", BASE);
    process.exit(1);
  }

  const files = walkDir(BASE);
  console.log(`📁 Archivos encontrados: ${files.length}`);

  let imported = 0;
  const personas = {};

  for (const { file, name, dir } of files) {
    const relPath = path.relative(path.resolve(__dirname, ".."), file).replace(/\\/g, "/");
    const relDir = path.relative(BASE, dir); // relative to BASE — avoids matching base dir name
    const persona = extractPersona(name, relDir);
    const año = extractYear(dir);
    const mes = extractMonth(dir, name);
    const medio = extractMedioPago(name);

    personas[persona] = (personas[persona] || 0) + 1;

    // Check if already imported (by archivo_adjunto)
    const existing = await db.execute({
      sql: `SELECT id FROM viaticos WHERE archivo_adjunto = ? LIMIT 1`,
      args: [relPath],
    });
    if (existing.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO viaticos (empleado, fecha, tipo, importe, moneda, descripcion, aprobado, archivo_adjunto, año, mes, medio_pago)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        persona,
        año ? `${año}-${String(mes || 1).padStart(2, "0")}-01` : "",
        "rendicion",
        0,
        "ARS",
        `Rendición ${persona}${mes ? ` - mes ${mes}` : ""}`,
        0,
        relPath,
        año,
        mes,
        medio,
      ],
    });
    imported++;
  }

  console.log(`\n✅ Rendiciones importadas: ${imported}`);
  console.log("\n📊 Por persona:");
  for (const [persona, count] of Object.entries(personas).sort()) {
    console.log(`  ${persona}: ${count} archivos`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
