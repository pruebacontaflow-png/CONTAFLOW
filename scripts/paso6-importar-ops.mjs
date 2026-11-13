/**
 * Paso 6a: Importar Órdenes de Pago desde pagos-2025.csv
 * - 576 filas → OPs numeradas "OP 2025-0001"
 * - Vincula a facturas_recibidas por tipo+pv+num+cuit
 * - pago_a_cuenta_2024=1 cuando fc_no_encontradas_en_2025 ≠ vacío
 * - a_revisar=1 cuando diferencia_sumando_transferencias ≠ 0
 * - Copia comprobantes a facturas-pdf/comprobantes/
 * - Skip: filas sin CUIT en proveedores (no son proveedores del sistema)
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, parseFecha, parseNum } from "./csvUtils.mjs";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PDF_SRC = path.join(ROOT, "datos/2025");
const COMP_DIR = path.join(ROOT, "facturas-pdf/comprobantes");
const CUENTA_BANCARIA_ID = 13; // Credicoop IT Click

mkdirSync(COMP_DIR, { recursive: true });

function normCuit(c) { return (c || "").replace(/[-\s]/g, ""); }
function pad4(n) { return String(n).padStart(4, "0"); }

function parseFacRefList(s) {
  if (!s || !s.trim()) return [];
  return s.split(";").map(ref => ref.trim()).filter(Boolean).map(ref => {
    // "Factura C 00001-00000058" → {tipo, pv, num}
    const m = ref.match(/^(.+?)\s+(\d{5})-(\d{8})$/);
    if (!m) return null;
    return { tipo: m[1].trim(), pv: m[2], num: m[3] };
  }).filter(Boolean);
}

async function run() {
  const db = openDB();
  const rows = parseCSV(path.join(ROOT, "datos/2025/importar/pagos-2025.csv"));

  // Build proveedores map: cuit_sin_guiones → proveedor_id
  const provRes = await db.execute("SELECT id, cuit FROM proveedores");
  const provMap = {};
  for (const p of provRes.rows) {
    provMap[normCuit(p.cuit)] = p.id;
  }

  // Build facturas_recibidas map: "tipo|pv|num" → id (all facturas)
  const frRes = await db.execute("SELECT id, cuit_emisor, tipo_comprobante, punto_venta, numero FROM facturas_recibidas");
  const frMap = {}; // "cuit_norm|tipo|pv|num" → id
  for (const fr of frRes.rows) {
    const cuit = normCuit(fr.cuit_emisor);
    const key = `${cuit}|${fr.tipo_comprobante}|${fr.punto_venta}|${fr.numero}`;
    frMap[key] = fr.id;
    // Also key without cuit for fuzzy match
    const keyNoCuit = `${fr.tipo_comprobante}|${fr.punto_venta}|${fr.numero}`;
    if (!frMap[keyNoCuit]) frMap[keyNoCuit] = fr.id;
  }

  let seq = 0;
  let creados = 0, skipped = 0, noProvFound = 0;
  const sinProveedor = [];
  const sinFacturas = [];

  for (const r of rows) {
    const cuitNorm = normCuit(r.cuit);
    const provId = provMap[cuitNorm];

    if (!provId) {
      noProvFound++;
      sinProveedor.push({ cuit: r.cuit, proveedor: r.proveedor, comentario: r.comentario_banco });
      skipped++;
      continue;
    }

    seq++;
    const opNumero = `OP 2025-${pad4(seq)}`;
    const fecha = parseFecha(r.fecha) ?? "";
    const importePagado = parseNum(r.importe_pagado);
    const totalRetenciones = parseNum(r.total_retenciones);
    const totalFacturas = parseNum(r.total_facturas);
    // importe_bruto: facturas sum, or if none, pagado + retenciones
    const importeBruto = totalFacturas > 0 ? totalFacturas : importePagado + totalRetenciones;
    const diferencia = r.diferencia_sumando_transferencias?.trim()
      ? parseNum(r.diferencia_sumando_transferencias)
      : 0;

    // Flags
    const pago2024 = r.fc_no_encontradas_en_2025?.trim() ? 1 : 0;
    let aRevisar = 0;
    const motivosRevisar = [];
    if (diferencia !== 0) {
      aRevisar = 1;
      motivosRevisar.push(`Diferencia $${diferencia.toFixed(2)} vs suma transferencias`);
    }

    // Parse factura references
    const facRefs = parseFacRefList(r.facturas);
    const matchedItems = [];
    const noEncontradas = [];

    for (const ref of facRefs) {
      const keyCuit = `${cuitNorm}|${ref.tipo}|${ref.pv}|${ref.num}`;
      const keyNoCuit = `${ref.tipo}|${ref.pv}|${ref.num}`;
      const facId = frMap[keyCuit] ?? frMap[keyNoCuit];
      if (facId) {
        matchedItems.push({ factura_id: facId, tipo: "factura", descripcion: `${ref.tipo} ${ref.pv}-${ref.num}` });
      } else {
        noEncontradas.push(`${ref.tipo} ${ref.pv}-${ref.num}`);
      }
    }

    if (facRefs.length > 0 && noEncontradas.length > 0) {
      aRevisar = 1;
      motivosRevisar.push(`No encontradas: ${noEncontradas.join("; ")}`);
    }
    if (!r.facturas?.trim() && !r.fc_no_encontradas_en_2025?.trim()) {
      aRevisar = 1;
      motivosRevisar.push("Sin referencia de facturas (SIN FC)");
    }

    // Copy comprobante
    let comprobantePaths = "";
    if (r.comprobante_pago?.trim()) {
      const srcRel = r.comprobante_pago.trim();
      const srcFull = path.join(PDF_SRC, srcRel);
      if (existsSync(srcFull)) {
        const ext = path.extname(srcRel) || ".pdf";
        const destName = `${opNumero.replace(/\s/g, "_")}${ext}`;
        const destFull = path.join(COMP_DIR, destName);
        if (!existsSync(destFull)) {
          try { copyFileSync(srcFull, destFull); } catch {}
        }
        comprobantePaths = `facturas-pdf/comprobantes/${destName}`;
      }
    }

    // Insert ordenes_pago
    const opRes = await db.execute(
      `INSERT INTO ordenes_pago
         (proveedor_id, fecha, numero, importe_bruto, total_retenciones, importe_neto,
          cuenta_bancaria_id, estado, observaciones, concepto, es_anticipo,
          op_nro_tango, linea_extracto_id, a_revisar, revisar_motivo,
          pago_a_cuenta_2024, diferencia, comprobante_paths,
          cuit_proveedor, nombre_en_banco, origen)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'historico_2025')`,
      [
        provId, fecha, opNumero,
        importeBruto, totalRetenciones, importePagado,
        CUENTA_BANCARIA_ID, "pagado",
        r.comentario_banco?.trim() || "", "", 0,
        r.op_nro_tango?.trim() || "",
        parseInt(r.linea_extracto) || null,
        aRevisar, motivosRevisar.join(" | "),
        pago2024, diferencia,
        comprobantePaths,
        r.cuit?.trim() || "", r.nombre_en_banco?.trim() || "",
      ]
    );
    const opId = opRes.lastInsertRowid;

    // Insert items
    for (const item of matchedItems) {
      await db.execute(
        `INSERT INTO ordenes_pago_items (orden_pago_id, factura_id, importe, tipo, descripcion)
         VALUES (?,?,?,?,?)`,
        [opId, item.factura_id, 0, item.tipo, item.descripcion]
      );
    }
    if (pago2024) {
      await db.execute(
        `INSERT INTO ordenes_pago_items (orden_pago_id, factura_id, importe, tipo, descripcion)
         VALUES (?,NULL,?,?,?)`,
        [opId, importePagado, "factura_2024", `FC 2024 nro: ${r.fc_no_encontradas_en_2025}`]
      );
    }

    creados++;
  }

  console.log(`\nOPs creadas: ${creados}`);
  console.log(`Sin proveedor (skipped): ${noProvFound}`);
  if (sinProveedor.length > 0) {
    console.log("\nProveedores no encontrados:");
    sinProveedor.forEach(p => console.log(` CUIT ${p.cuit}: ${p.proveedor} | ${p.comentario?.substring(0, 60)}`));
  }

  // Final stats
  const totalOPs = await db.execute("SELECT COUNT(*) n FROM ordenes_pago WHERE origen='historico_2025'");
  const aRevisarCnt = await db.execute("SELECT COUNT(*) n FROM ordenes_pago WHERE a_revisar=1 AND origen='historico_2025'");
  const pago2024Cnt = await db.execute("SELECT COUNT(*) n FROM ordenes_pago WHERE pago_a_cuenta_2024=1 AND origen='historico_2025'");
  console.log(`\nTotal OPs en DB: ${totalOPs.rows[0].n}`);
  console.log(`A revisar: ${aRevisarCnt.rows[0].n}`);
  console.log(`Pago a cuenta 2024: ${pago2024Cnt.rows[0].n}`);

  db.close();
}

console.log("=== IMPORTAR ÓRDENES DE PAGO 2025 ===\n");
await run();
console.log("\n✅ OPs importadas.");
