/**
 * Paso 6b: Importar retenciones SICORE desde retenciones-2025.csv
 * - 44 certificados → retenciones_aplicadas
 * - Vincula a ordenes_pago por linea_extracto_id (mapeado desde pagos-2025.csv)
 * - 7 sin CUIT → resuelve por nombre desde otros certs del mismo archivo
 * - 8 sin match en pagos → orden_pago_id NULL, se informa
 * - Copia PDFs a facturas-pdf/retenciones/
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, parseFecha, parseNum } from "./csvUtils.mjs";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_SRC = path.join(ROOT, "datos/2025");
const RET_DIR = path.join(ROOT, "facturas-pdf/retenciones");

mkdirSync(RET_DIR, { recursive: true });

function normCuit(c) { return (c || "").replace(/[-\s]/g, ""); }

function detectTipo(impuesto) {
  const i = (impuesto || "").toLowerCase();
  if (i.includes("ganancias")) return "ganancias";
  if (i.includes("iibb") || i.includes("ingresos brutos")) return "iibb";
  return "otro";
}

function mapConfigId(impuesto, regimen) {
  // Map sin hardcodear alícuotas - solo mapea descripción a config existente
  const i = (impuesto || "").toLowerCase();
  const r = (regimen || "").toLowerCase();
  if (i.includes("ganancias")) {
    if (r.includes("locaci") || r.includes("servicio")) return 2; // config_id 2
    if (r.includes("compra")) return 3; // config_id 3
    return 1; // config_id 1
  }
  if (r.includes("agip") || r.includes("ciudad")) return 4;
  if (r.includes("arba") || r.includes("provincia")) return 5;
  return null;
}

async function run() {
  const db = openDB();
  const rets = parseCSV(path.join(ROOT, "datos/2025/importar/retenciones-2025.csv"));
  const pagos = parseCSV(path.join(ROOT, "datos/2025/importar/pagos-2025.csv"));

  // Build cert → linea_extracto from pagos CSV
  const certToLinea = {};
  for (const p of pagos) {
    if (!p.certificados_retencion?.trim()) continue;
    const certs = p.certificados_retencion.split(";").map(s => s.trim()).filter(Boolean);
    certs.forEach(c => { certToLinea[c] = p.linea_extracto; });
  }

  // Build linea_extracto → orden_pago_id from DB
  const opsRes = await db.execute(
    "SELECT id, linea_extracto_id FROM ordenes_pago WHERE origen='historico_2025' AND linea_extracto_id IS NOT NULL"
  );
  const lineaToOpId = {};
  for (const op of opsRes.rows) {
    lineaToOpId[op.linea_extracto_id] = op.id;
  }

  // Build name→cuit from certs that do have CUIT (for filling in missing ones)
  const nameToCuit = {};
  for (const r of rets) {
    const cuit = normCuit(r.cuit_retenido);
    if (cuit && r.retenido) {
      nameToCuit[r.retenido.trim().toLowerCase()] = r.cuit_retenido.trim();
    }
  }

  let creados = 0, sinOP = 0, sinCuitResuelto = 0;
  const sinOPList = [];

  for (const r of rets) {
    const cert = r.certificado?.trim() || "";
    const fecha = parseFecha(r.fecha) ?? "";
    const montoComp = parseNum(r.monto_comprobante);
    const montoRet = parseNum(r.monto_retencion);
    const alicuota = montoComp > 0 ? parseFloat((montoRet / montoComp * 100).toFixed(4)) : 0;

    // Resolve CUIT
    let cuitRet = r.cuit_retenido?.trim() || "";
    if (!normCuit(cuitRet)) {
      const nombre = r.retenido?.trim().toLowerCase() || "";
      const resolved = nameToCuit[nombre];
      if (resolved) {
        cuitRet = resolved;
        sinCuitResuelto++;
      }
    }

    // Find OP
    const lineaExtracto = certToLinea[cert];
    const opId = lineaExtracto ? (lineaToOpId[lineaExtracto] ?? null) : null;
    if (!opId) {
      sinOP++;
      sinOPList.push({ cert, retenido: r.retenido, cuit: cuitRet, impuesto: r.impuesto });
    }

    // Copy certificate PDF
    let certPath = "";
    if (r.archivo?.trim()) {
      const srcFull = path.join(PDF_SRC, r.archivo.trim());
      if (existsSync(srcFull)) {
        const ext = path.extname(r.archivo) || ".pdf";
        const certSafe = cert.replace(/[^0-9]/g, "_");
        const destName = `ret_${certSafe}${ext}`;
        const destFull = path.join(RET_DIR, destName);
        if (!existsSync(destFull)) {
          try { copyFileSync(srcFull, destFull); } catch {}
        }
        certPath = `facturas-pdf/retenciones/${destName}`;
      }
    }

    // Parse comprobante origen from comprobante field
    // "01 - Factura / Tique Factura / Tique Nro.    00002-00002474"
    const compStr = (r.comprobante || "").replace(/\s+/g, " ").trim();

    const configId = mapConfigId(r.impuesto, r.regimen);
    const tipo = detectTipo(r.impuesto);

    await db.execute(
      `INSERT INTO retenciones_aplicadas
         (orden_pago_id, config_id, tipo, descripcion, codigo_regimen,
          base_calculo, alicuota, importe, certificado_numero,
          fecha, cuit_retenido, retenido, certificado_path,
          monto_comprobante, comprobante_origen)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        opId, configId, tipo,
        `${r.impuesto} - ${r.regimen}`,
        "", // codigo_regimen: en blanco, viene de config
        montoComp, alicuota, montoRet,
        cert, fecha, cuitRet, r.retenido?.trim() || "",
        certPath, montoComp, compStr,
      ]
    );
    creados++;
  }

  console.log(`\nRetenciones importadas: ${creados}`);
  console.log(`Sin OP vinculada: ${sinOP}`);
  console.log(`CUITs resueltos por nombre: ${sinCuitResuelto}`);

  if (sinOPList.length > 0) {
    console.log("\nRetenciones sin OP:");
    sinOPList.forEach(r => console.log(`  ${r.cert}: ${r.retenido} (${r.cuit}) - ${r.impuesto}`));
  }

  const total = await db.execute("SELECT COUNT(*) n FROM retenciones_aplicadas");
  console.log(`\nTotal en DB: ${total.rows[0].n}`);
  db.close();
}

console.log("=== IMPORTAR RETENCIONES SICORE 2025 ===\n");
await run();
console.log("\n✅ Retenciones importadas.");
