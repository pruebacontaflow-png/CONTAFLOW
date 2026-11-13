// Inspect the Excel file structure to plan the import
const XLSX = require("xlsx");
const path = require("path");

const xlsxPath = path.resolve(__dirname, "../datos/2025/comercial/Comisiones - Time Out ARG.xlsx");
const wb = XLSX.readFile(xlsxPath);

console.log("Sheets:", wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\n=== ${sheetName} (${data.length} rows) ===`);
  // Print first 10 rows
  data.slice(0, 10).forEach((row, i) => {
    const cells = row.map(c => String(c).substring(0, 20)).join(" | ");
    console.log(`  [${i}] ${cells}`);
  });
  if (data.length > 10) {
    console.log(`  ... ${data.length - 10} more rows`);
  }
}
