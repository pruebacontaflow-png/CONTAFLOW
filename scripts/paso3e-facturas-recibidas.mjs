/**
 * Paso 3e: Importar 829 facturas recibidas
 * Detecta duplicados por cuit_emisor + tipo + punto_venta + numero
 * Copia PDFs a facturas-pdf/recibidas/
 * Marca origen='historico_2025'
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, parseFecha, parseNum } from "./csvUtils.mjs";
import { copyFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARCHIVO = "datos/2025/importar/facturas-recibidas.csv";
const PDF_SRC = path.join(ROOT, "datos/2025/pdf");
const PDF_DEST = path.join(ROOT, "facturas-pdf/recibidas");
mkdirSync(PDF_DEST, { recursive: true });

const rows = parseCSV(ARCHIVO);
console.log(`Leyendo ${rows.length} facturas recibidas...`);

const db = openDB();

// Mapa CUIT → proveedor_id
const provRes = await db.execute("SELECT id, cuit FROM proveedores");
const provPorCuit = {};
for (const p of provRes.rows) provPorCuit[(p.cuit || "").replace(/-/g, "")] = p.id;

let ins = 0, dup = 0, err = 0, pdfCopied = 0, pdfMissing = 0;
const sinProveedor = [];

for (const r of rows) {
  const cuit_emisor = (r.cuit_emisor || "").trim();
  const tipo_comprobante = (r.tipo_comprobante || "").trim();
  const punto_venta = (r.punto_venta || "").trim().padStart(5, "0");
  const numero = (r.numero || "").trim().padStart(8, "0");

  // Deduplicación
  const exDup = await db.execute(`SELECT id FROM facturas_recibidas
    WHERE cuit_emisor=? AND tipo_comprobante=? AND punto_venta=? AND numero=?`,
    [cuit_emisor, tipo_comprobante, punto_venta, numero]);
  if (exDup.rows.length > 0) { dup++; continue; }

  // Buscar proveedor
  const cuitNum = cuit_emisor.replace(/-/g, "");
  let proveedor_id = provPorCuit[cuitNum] || null;
  if (!proveedor_id) {
    // Crear proveedor mínimo
    const razon = (r.razon_social_emisor || cuit_emisor).trim();
    const resIns = await db.execute(
      "INSERT INTO proveedores (cuit, razon_social, condicion_iva, activo) VALUES (?,?,?,1)",
      [cuit_emisor, razon, "Responsable Inscripto"]
    );
    proveedor_id = Number(resIns.lastInsertRowid);
    provPorCuit[cuitNum] = proveedor_id;
    sinProveedor.push(cuit_emisor);
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
        pdf_path = `facturas-pdf/recibidas/${basename}`;
        pdfCopied++;
      } catch {}
    } else {
      pdfMissing++;
    }
  }

  // Mapear estado_pago → estado
  const estado_pago = (r.estado_pago || "").trim();
  const estado = estado_pago === "Pagado" ? "pagado" : "pendiente_pago";

  const fecha_emision = parseFecha(r.fecha_emision) ?? "";
  const fecha_vencimiento = parseFecha(r.fecha_vencimiento) ?? "";
  const fecha_pago = parseFecha(r.fecha_pago) ?? null;

  const neto_gravado = parseNum(r.neto_gravado);
  const iva_21 = parseNum(r.iva_21);
  const iva_10_5 = parseNum(r.iva_10_5);
  const iva_27 = parseNum(r.iva_27);
  const iva_otras = parseNum(r.iva_otras);
  const neto_no_gravado = parseNum(r.neto_no_gravado);
  const exento = parseNum(r.exento);
  const percepcion_iva = parseNum(r.percepcion_iva);
  const percepcion_iibb = parseNum(r.percepcion_iibb);
  const percepcion_otras = parseNum(r.percepcion_otras);
  const importe_sin_iva = parseNum(r.importe_sin_iva_discriminado);
  const total = parseNum(r.total);
  const tipo_cambio = parseNum(r.tipo_cambio) || 1;

  // importe_neto y importe_total para columnas legacy
  const importe_neto = neto_gravado || importe_sin_iva;
  const importe_iva = iva_21 + iva_10_5 + iva_27 + iva_otras;

  try {
    await db.execute(`INSERT INTO facturas_recibidas (
      proveedor_id, cuit_emisor, tipo_comprobante, punto_venta, numero,
      fecha_emision, fecha_vencimiento, importe_neto, importe_iva, importe_total,
      neto_gravado, neto_no_gravado, exento,
      percepcion_iva, percepcion_iibb, percepcion_otras,
      iva_otras, importe_sin_iva_discriminado,
      moneda, tipo_cambio, cae,
      concepto, periodo, proyecto, centro_costo, area, linea_negocio,
      estado, estado_pago, fecha_pago,
      pdf_path, origen
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [proveedor_id, cuit_emisor, tipo_comprobante, punto_venta, numero,
     fecha_emision, fecha_vencimiento, importe_neto, importe_iva, total,
     neto_gravado, neto_no_gravado, exento,
     percepcion_iva, percepcion_iibb, percepcion_otras,
     iva_otras, importe_sin_iva,
     r.moneda || "ARS", tipo_cambio, r.cae || "",
     r.concepto || "", r.periodo || "", r.proyecto || "",
     r.centro_costo || "", r.area || "", r.linea_negocio || "",
     estado, estado_pago, fecha_pago,
     pdf_path, "historico_2025"]);

    // Detalle IVA en facturas_iva_detalle
    const fid = (await db.execute("SELECT last_insert_rowid() id")).rows[0].id;
    if (iva_21 > 0)
      await db.execute(
        "INSERT INTO facturas_iva_detalle (factura_id, tabla, alicuota, base_imponible, importe) VALUES (?,?,?,?,?)",
        [fid, "recibidas", "21%", neto_gravado, iva_21]);
    if (iva_10_5 > 0)
      await db.execute(
        "INSERT INTO facturas_iva_detalle (factura_id, tabla, alicuota, base_imponible, importe) VALUES (?,?,?,?,?)",
        [fid, "recibidas", "10.5%", neto_gravado, iva_10_5]);
    if (iva_27 > 0)
      await db.execute(
        "INSERT INTO facturas_iva_detalle (factura_id, tabla, alicuota, base_imponible, importe) VALUES (?,?,?,?,?)",
        [fid, "recibidas", "27%", neto_gravado, iva_27]);

    ins++;
  } catch (e) {
    console.error(`  ERROR ${cuit_emisor} ${tipo_comprobante} ${punto_venta}-${numero}: ${e.message}`);
    err++;
  }
}

const total_db = await db.execute("SELECT COUNT(*) n FROM facturas_recibidas");
console.log(`\n✅ Facturas recibidas: ${ins} insertadas, ${dup} duplicadas, ${err} errores`);
console.log(`   PDFs: ${pdfCopied} copiados, ${pdfMissing} no encontrados`);
console.log(`   Proveedores auto-creados: ${sinProveedor.length}`);
if (sinProveedor.length > 0) console.log(`   CUITs sin proveedor previo: ${sinProveedor.slice(0,10).join(", ")}${sinProveedor.length > 10 ? "..." : ""}`);
console.log(`   Total en DB: ${total_db.rows[0].n}`);

// Resumen por tipo de comprobante
const porTipo = await db.execute(
  "SELECT tipo_comprobante, COUNT(*) n, SUM(importe_total) t FROM facturas_recibidas GROUP BY tipo_comprobante ORDER BY n DESC"
);
console.log("\n   Por tipo:");
porTipo.rows.forEach(r => console.log(`   ${r.tipo_comprobante}: ${r.n} ($${Number(r.t).toLocaleString('es-AR')})`));

db.close();
