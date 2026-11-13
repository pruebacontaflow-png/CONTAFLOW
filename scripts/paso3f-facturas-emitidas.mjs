/**
 * Paso 3f: Importar 158 facturas emitidas
 * Detecta duplicados por cuit_receptor + tipo + punto_venta + numero
 * Copia PDFs a facturas-pdf/emitidas/
 * Marca origen='historico_2025'
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, parseFecha, parseNum } from "./csvUtils.mjs";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARCHIVO = "datos/2025/importar/facturas-emitidas.csv";
const PDF_SRC = path.join(ROOT, "datos/2025/pdf");
const PDF_DEST = path.join(ROOT, "facturas-pdf/emitidas");
mkdirSync(PDF_DEST, { recursive: true });

const rows = parseCSV(ARCHIVO);
console.log(`Leyendo ${rows.length} facturas emitidas...`);

const db = openDB();

// Mapa CUIT → cliente_id
const cliRes = await db.execute("SELECT id, cuit FROM clientes");
const cliPorCuit = {};
for (const c of cliRes.rows) cliPorCuit[(c.cuit || "").replace(/-/g, "")] = c.id;

let ins = 0, dup = 0, err = 0, pdfCopied = 0, pdfMissing = 0;
const sinCliente = [];

for (const r of rows) {
  const cuit_receptor = (r.cuit_receptor || "").trim();
  const tipo_comprobante = (r.tipo_comprobante || "").trim();
  const punto_venta = (r.punto_venta || "").trim().padStart(5, "0");
  const numero = (r.numero || "").trim().padStart(8, "0");

  // Deduplicación
  const exDup = await db.execute(`SELECT id FROM facturas_emitidas
    WHERE cuit_receptor=? AND tipo_comprobante=? AND punto_venta=? AND numero=?`,
    [cuit_receptor, tipo_comprobante, punto_venta, numero]);
  if (exDup.rows.length > 0) { dup++; continue; }

  // Buscar cliente
  const cuitNum = cuit_receptor.replace(/-/g, "");
  let cliente_id = cliPorCuit[cuitNum] || null;
  if (!cliente_id) {
    const razon = (r.razon_social_receptor || cuit_receptor).trim();
    const resIns = await db.execute(
      "INSERT INTO clientes (cuit, razon_social, condicion_iva, activo) VALUES (?,?,?,1)",
      [cuit_receptor, razon, "Responsable Inscripto"]
    );
    cliente_id = Number(resIns.lastInsertRowid);
    cliPorCuit[cuitNum] = cliente_id;
    sinCliente.push(cuit_receptor);
  }

  // PDF
  let pdf_path = "";
  const pdfRelativo = (r.pdf || "").trim();
  if (pdfRelativo) {
    const srcPdf = path.join(PDF_SRC, pdfRelativo);
    const basename = path.basename(pdfRelativo);
    const destPdf = path.join(PDF_DEST, basename);
    if (existsSync(srcPdf)) {
      try {
        copyFileSync(srcPdf, destPdf);
        pdf_path = `facturas-pdf/emitidas/${basename}`;
        pdfCopied++;
      } catch {}
    } else {
      pdfMissing++;
    }
  }

  const estado_cobro = (r.estado_cobro || "").trim();
  const estado = estado_cobro === "Cobrado" ? "cobrado" : "pendiente_cobro";

  const neto_gravado = parseNum(r.neto_gravado);
  const iva_21 = parseNum(r.iva_21);
  const iva_10_5 = parseNum(r.iva_10_5);
  const iva_27 = parseNum(r.iva_27);
  const neto_no_gravado = parseNum(r.neto_no_gravado);
  const exento = parseNum(r.exento);
  const otros_tributos = parseNum(r.otros_tributos);
  const total = parseNum(r.total);
  const tipo_cambio = parseNum(r.tipo_cambio) || 1;
  const importe_iva = iva_21 + iva_10_5 + iva_27;

  const fecha_emision = parseFecha(r.fecha_emision) ?? "";
  const fecha_cobro_val = parseFecha(r.fecha_cobro) ?? null;

  try {
    await db.execute(`INSERT INTO facturas_emitidas (
      cliente_id, cuit_receptor, tipo_comprobante, punto_venta, numero,
      fecha_emision, fecha_vencimiento, importe_neto, importe_iva, importe_total,
      neto_gravado, neto_no_gravado, exento, otros_tributos,
      moneda, tipo_cambio, cae,
      concepto, periodo, proyecto, linea_negocio,
      estado, estado_cobro, fecha_cobro,
      pdf_path, origen
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [cliente_id, cuit_receptor, tipo_comprobante, punto_venta, numero,
     fecha_emision, "", neto_gravado, importe_iva, total,
     neto_gravado, neto_no_gravado, exento, otros_tributos,
     r.moneda || "ARS", tipo_cambio, r.cae || "",
     r.concepto || "", r.periodo || "", r.proyecto || "",
     r.linea_negocio || "",
     estado, estado_cobro, fecha_cobro_val,
     pdf_path, "historico_2025"]);
    ins++;
  } catch (e) {
    console.error(`  ERROR ${cuit_receptor} ${tipo_comprobante} ${punto_venta}-${numero}: ${e.message}`);
    err++;
  }
}

const total_db = await db.execute("SELECT COUNT(*) n FROM facturas_emitidas");
console.log(`\n✅ Facturas emitidas: ${ins} insertadas, ${dup} duplicadas, ${err} errores`);
console.log(`   PDFs: ${pdfCopied} copiados, ${pdfMissing} no encontrados`);
console.log(`   Clientes auto-creados: ${sinCliente.length}`);
console.log(`   Total en DB: ${total_db.rows[0].n}`);

const porTipo = await db.execute(
  "SELECT tipo_comprobante, COUNT(*) n, SUM(importe_total) t FROM facturas_emitidas GROUP BY tipo_comprobante"
);
console.log("\n   Por tipo:");
porTipo.rows.forEach(r => console.log(`   ${r.tipo_comprobante}: ${r.n} ($${Number(r.t).toLocaleString('es-AR')})`));

db.close();
