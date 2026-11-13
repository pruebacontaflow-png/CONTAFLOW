/**
 * Paso 5a: Renombrar PDFs con nombre único y actualizar pdf_path en DB
 * Nombre: <cuit_sin_guiones>_<tipo_abrev>_<pv5>_<num8>[_N].<ext>
 * Vuelve a copiar PDFs faltantes desde datos/2025/pdf/
 * Maneja múltiples PDFs por comprobante (separados por ; en CSV)
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV } from "./csvUtils.mjs";
import { copyFileSync, renameSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_SRC = path.join(ROOT, "datos/2025/pdf");
const PDF_DIR = path.join(ROOT, "facturas-pdf");

function tipoAbrev(tipo) {
  const t = (tipo || "").toLowerCase();
  if (t.includes("nota de crédito a") || t.includes("nota de credito a")) return "NCA";
  if (t.includes("nota de crédito b") || t.includes("nota de credito b")) return "NCB";
  if (t.includes("nota de crédito c") || t.includes("nota de credito c")) return "NCC";
  if (t.includes("nota de débito a") || t.includes("nota de debito a")) return "NDA";
  if (t.includes("factura a")) return "FA";
  if (t.includes("factura b")) return "FB";
  if (t.includes("factura c")) return "FC";
  if (t.includes("invoice")) return "INV";
  if (t.includes("recibo")) return "REC";
  return "DOC";
}

function sanitizeCuit(c) { return (c || "").replace(/[-\s]/g, ""); }
function pad(n, len) { return String(n).padStart(len, "0"); }

async function procesarFacturas(tabla, cuitCol, dirDest, csvFile) {
  mkdirSync(path.join(PDF_DIR, dirDest), { recursive: true });
  const db = openDB();

  const csvRows = parseCSV(csvFile);
  const csvByKey = {};
  for (const r of csvRows) {
    const cuit = sanitizeCuit(r[cuitCol] || r.cuit_emisor || r.cuit_receptor || "");
    const pv = pad(r.punto_venta || "0", 5);
    const num = pad(r.numero || "0", 8);
    const tipo = tipoAbrev(r.tipo_comprobante || "");
    const key = `${cuit}_${tipo}_${pv}_${num}`;
    csvByKey[key] = (r.pdf || "").trim();
  }

  const rows = await db.execute(
    `SELECT id, ${cuitCol}, tipo_comprobante, punto_venta, numero, pdf_path FROM ${tabla}`
  );

  let renamed = 0, copied = 0, missing = 0, sinPdf = 0, multiPdf = 0;
  const pdfCount = {}; // key → count of PDFs stored

  for (const fr of rows.rows) {
    const cuit = sanitizeCuit(fr[cuitCol] || "");
    const tipo = tipoAbrev(fr.tipo_comprobante || "");
    const pv = pad(fr.punto_venta || "0", 5);
    const num = pad(fr.numero || "0", 8);
    const baseKey = `${cuit}_${tipo}_${pv}_${num}`;

    // Obtener paths del CSV
    const csvPdf = csvByKey[baseKey] || "";
    const pdfPaths = csvPdf ? csvPdf.split(";").map(s => s.trim()).filter(Boolean) : [];

    if (pdfPaths.length === 0) {
      // Ver si hay archivo actual en DB que renombrar
      const existing = (fr.pdf_path || "").trim();
      if (existing) {
        const existingFullPath = path.join(ROOT, existing);
        if (existsSync(existingFullPath)) {
          const ext = path.extname(existing) || ".pdf";
          const newName = `${baseKey}${ext}`;
          const newPath = path.join(PDF_DIR, dirDest, newName);
          try {
            if (!existsSync(newPath)) renameSync(existingFullPath, newPath);
            await db.execute(
              `UPDATE ${tabla} SET pdf_path=? WHERE id=?`,
              [`facturas-pdf/${dirDest}/${newName}`, fr.id]
            );
            renamed++;
          } catch {}
        }
      } else {
        sinPdf++;
      }
      continue;
    }

    // Procesar cada PDF del CSV
    const newPaths = [];
    for (let i = 0; i < pdfPaths.length; i++) {
      const srcRel = pdfPaths[i];
      const srcFull = path.join(PDF_SRC, srcRel);
      const ext = path.extname(srcRel) || ".pdf";
      const suffix = i === 0 ? "" : `_${i + 1}`;
      const newName = `${baseKey}${suffix}${ext}`;
      const destFull = path.join(PDF_DIR, dirDest, newName);

      if (!existsSync(destFull)) {
        if (existsSync(srcFull)) {
          try {
            copyFileSync(srcFull, destFull);
            copied++;
          } catch (e) {
            console.error(`  Copy error ${srcRel}: ${e.message}`);
            missing++;
            continue;
          }
        } else {
          // Maybe already in facturas-pdf/ with old name - try to rename
          const oldPath = fr.pdf_path ? path.join(ROOT, fr.pdf_path) : null;
          if (i === 0 && oldPath && existsSync(oldPath)) {
            try { renameSync(oldPath, destFull); renamed++; } catch {}
          } else {
            missing++;
            continue;
          }
        }
      }
      newPaths.push(`facturas-pdf/${dirDest}/${newName}`);
    }

    if (newPaths.length > 0) {
      const mainPath = newPaths[0];
      const extraPaths = newPaths.slice(1).join(";");
      await db.execute(
        `UPDATE ${tabla} SET pdf_path=?, pdf_extra_paths=? WHERE id=?`,
        [mainPath, extraPaths, fr.id]
      );
      if (pdfPaths.length > 1) multiPdf++;
    }
  }

  // Renombrar archivos que quedaron con nombre original (no estaban en CSV por alguna razón)
  // ya se manejó arriba

  console.log(`  ${tabla}: ${renamed} renombrados, ${copied} copiados nuevos, ${missing} faltantes, ${sinPdf} sin PDF, ${multiPdf} con múltiples PDFs`);
  db.close();
  return { renamed, copied, missing, sinPdf, multiPdf };
}

console.log("=== RENOMBRAR PDFs ===\n");
await procesarFacturas(
  "facturas_recibidas", "cuit_emisor", "recibidas",
  "datos/2025/importar/facturas-recibidas.csv"
);
await procesarFacturas(
  "facturas_emitidas", "cuit_receptor", "emitidas",
  "datos/2025/importar/facturas-emitidas.csv"
);

console.log("\n✅ PDFs renombrados y DB actualizada.");
