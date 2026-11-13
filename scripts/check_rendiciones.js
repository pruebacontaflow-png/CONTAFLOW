const fs = require("fs");
const path = require("path");
// Note: space in folder name
const candidates = ["datos/rendiciones/06. Rendiciones Caja Chica - Maricel  y Rocío",
                    "datos/rendiciones/06. Rendiciones Caja Chica - Maricel y Rocío",
                    "datos/rendiciones/06. Rendiciones Caja Chica - Maricel  y Rocio",
                    "datos/rendiciones/06. Rendiciones Caja Chica - Maricel y Rocio"];
let BASE = null;
for (const c of candidates) {
  const full = path.resolve(__dirname, "..", c);
  if (fs.existsSync(full)) { BASE = full; break; }
}
if (!BASE) {
  // List what's in datos/rendiciones
  const dir = path.resolve(__dirname, "../datos/rendiciones");
  console.log("Contents of datos/rendiciones:", fs.readdirSync(dir));
  process.exit(1);
}
console.log("BASE:", BASE);

function walkDir(dir, results=[]) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, results);
    else if ([".pdf",".jpg",".jpeg",".png",".xlsx",".xls"].includes(path.extname(e.name).toLowerCase())) {
      results.push({ file: full, name: e.name, dir });
    }
  }
  return results;
}

const files = walkDir(BASE);
let sinAsignar = [];
for (const {file, name, dir} of files) {
  const parts = dir.split(/[\\/]/);
  let persona = null;
  for (const p of parts) {
    if (/^[A-ZÁÉÍÓÚ]{2,}/.test(p) && p !== "2025" && p !== "2026") { persona = p; break; }
  }
  if (!persona) sinAsignar.push({ name, dir: path.relative(BASE, dir) });
}
console.log("\nSin asignar (" + sinAsignar.length + "):");
const dirs = {};
sinAsignar.forEach(f => { dirs[f.dir || "(raiz)"] = (dirs[f.dir || "(raiz)"] || 0) + 1; });
for (const [d, c] of Object.entries(dirs)) console.log(`  ${d}: ${c} archivos`);
