import { readFileSync } from "fs";
const csv = readFileSync("datos/2025/importar/extracto-credicoop-2025.csv", "utf-8").replace(/^﻿/, "");
const lines = csv.split("\n").filter(l => l.trim());
const header = lines[0].split(",");
const idx = header.indexOf("cuenta_tango");
const dual = [], empty = [];
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  const ct = (cols[idx] || "").replace(/"/g, "").trim();
  if (/^\d+\s+y\s+\d+$/.test(ct)) dual.push(ct);
  if (!ct) empty.push(i);
}
console.log("Dual cuenta_tango:", dual.length, "→", [...new Set(dual)].join(", "));
console.log("Empty cuenta_tango:", empty.length);
