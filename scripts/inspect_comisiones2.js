// Deeper inspection of Comisiones 2025 sheet to find commission section
const XLSX = require("xlsx");
const path = require("path");
const xlsxPath = path.resolve(__dirname, "../datos/2025/comercial/Comisiones - Time Out ARG.xlsx");
const wb = XLSX.readFile(xlsxPath);

// Look at the 2025 sheet in detail
const ws = wb.Sheets["Comisiones Comercial - 2025"];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

console.log("=== COMISIONES 2025 — full scan for commission/tramos section ===\n");

// Find rows that contain keywords like "comisión", "tramo", "cumplimiento", "%"
const keywords = ["comisi", "tramo", "cumpli", "bonific", "porcent", "vendedor", "comercial"];
let inSection = false;
let sectionStart = -1;

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  const rowStr = row.map(c => String(c)).join(" ").toLowerCase();

  if (keywords.some(k => rowStr.includes(k))) {
    if (!inSection) {
      inSection = true;
      sectionStart = i;
      console.log(`\n--- Keyword section starting at row ${i} ---`);
    }
    const cells = row.map(c => String(c).substring(0, 25)).join(" | ");
    console.log(`[${i}] ${cells}`);
  } else if (inSection) {
    // Print a few lines after keyword section ends
    const cells = row.map(c => String(c).substring(0, 25)).join(" | ");
    if (cells.trim().replace(/\|/g,"").trim()) {
      console.log(`[${i}] ${cells}`);
    }
    if (i - sectionStart > 30) { inSection = false; }
  }
}

// Also print rows 1050-1068 (end of sheet)
console.log("\n=== Last 20 rows of 2025 sheet ===");
for (let i = Math.max(0, data.length - 20); i < data.length; i++) {
  const cells = data[i].map(c => String(c).substring(0, 20)).join(" | ");
  if (cells.trim().replace(/\|/g,"").trim()) console.log(`[${i}] ${cells}`);
}
