import { readFileSync } from "fs";

export function parseCSV(filePath) {
  const text = readFileSync(filePath, "utf-8").replace(/^﻿/, "").replace(/\r/g, "");
  const lines = text.split("\n");
  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = parseLine(line);
    const row = {};
    headers.forEach((h, j) => { row[h] = (cols[j] ?? "").trim(); });
    rows.push(row);
  }
  return rows;
}

function parseLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function parseFecha(s) {
  if (!s || s.trim() === "") return null;
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return null;
}

export function parseNum(s) {
  if (!s || s.trim() === "") return 0;
  const n = parseFloat(s.replace(",", "."));
  return isNaN(n) ? 0 : n;
}

export function siNo(s) {
  return (s || "").trim().toLowerCase() === "si" ? 1 : 0;
}
