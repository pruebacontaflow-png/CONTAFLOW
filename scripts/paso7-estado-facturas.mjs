/**
 * Paso 7: Importar estado_31_12_2025 y fecha_pago/fecha_cobro
 * desde los CSVs actualizados (facturas-recibidas.csv y facturas-emitidas.csv).
 * - FR: actualiza estado_31_12_2025 + fecha_pago
 * - FE: actualiza estado_31_12_2025 + fecha_cobro (bad dates → a_revisar)
 * - No cambia los 2 registros con fecha inválida (07/08/0205, 08/08/0205)
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV } from "./csvUtils.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function normCuit(c) { return (c || "").replace(/[-\s]/g, ""); }

async function run() {
  const db = openDB();
  const frCsv = parseCSV(path.join(ROOT, "datos/2025/importar/facturas-recibidas.csv"));
  const feCsv = parseCSV(path.join(ROOT, "datos/2025/importar/facturas-emitidas.csv"));

  // Build DB index for FR: "cuit|tipo|pv|num" → id
  const frDbRes = await db.execute(
    "SELECT id, cuit_emisor, tipo_comprobante, punto_venta, numero FROM facturas_recibidas"
  );
  const frDbMap = {};
  for (const r of frDbRes.rows) {
    const key = `${normCuit(r.cuit_emisor)}|${r.tipo_comprobante}|${r.punto_venta}|${r.numero}`;
    frDbMap[key] = r.id;
  }

  // Build DB index for FE: "cuit|tipo|pv|num" → id
  const feDbRes = await db.execute(
    "SELECT id, cuit_receptor, tipo_comprobante, punto_venta, numero FROM facturas_emitidas"
  );
  const feDbMap = {};
  for (const r of feDbRes.rows) {
    const key = `${normCuit(r.cuit_receptor)}|${r.tipo_comprobante}|${r.punto_venta}|${r.numero}`;
    feDbMap[key] = r.id;
  }

  // Update FR
  let frOk = 0, frNoMatch = 0;
  for (const r of frCsv) {
    // For Invoice (exterior) numbers like "#11", use padStart directly (not parseInt)
    const pvStr = /^\d+$/.test(r.punto_venta?.trim() || "")
      ? String(parseInt(r.punto_venta)).padStart(5, "0")
      : (r.punto_venta || "").trim().padStart(5, "0");
    const numStr = /^\d+$/.test(r.numero?.trim() || "")
      ? String(parseInt(r.numero)).padStart(8, "0")
      : (r.numero || "").trim().padStart(8, "0");
    const key = `${normCuit(r.cuit_emisor)}|${r.tipo_comprobante}|${pvStr}|${numStr}`;
    const id = frDbMap[key];
    if (!id) { frNoMatch++; continue; }

    const estado = r.estado_31_12_2025?.trim() || "";
    const fechaPago = r.fecha_pago?.trim() || "";

    await db.execute(
      "UPDATE facturas_recibidas SET estado_31_12_2025=?, fecha_pago=? WHERE id=?",
      [estado, fechaPago, id]
    );
    frOk++;
  }

  // Update FE
  let feOk = 0, feNoMatch = 0, feBadDate = 0;
  for (const r of feCsv) {
    const pv = String(parseInt(r.punto_venta)||0).padStart(5,'0');
    const num = String(parseInt(r.numero)||0).padStart(8,'0');
    const key = `${normCuit(r.cuit_receptor)}|${r.tipo_comprobante}|${pv}|${num}`;
    const id = feDbMap[key];
    if (!id) { feNoMatch++; continue; }

    const estado = r.estado_31_12_2025?.trim() || "";
    let fechaCobro = r.fecha_cobro?.trim() || "";
    let motivo = "";

    // Check for bad dates (year > 2100 as heuristic)
    if (fechaCobro && estado.includes("error")) {
      motivo = `Fecha cobro con error: ${fechaCobro}`;
      fechaCobro = ""; // Don't store invalid date
      feBadDate++;
    }

    await db.execute(
      "UPDATE facturas_emitidas SET estado_31_12_2025=?, fecha_cobro=?, motivo_revision=? WHERE id=?",
      [estado, fechaCobro, motivo, id]
    );
    feOk++;
  }

  console.log(`\nFR actualizadas: ${frOk} / no match: ${frNoMatch}`);
  console.log(`FE actualizadas: ${feOk} / no match: ${feNoMatch} / fechas inválidas: ${feBadDate}`);

  // Stats at 31/12
  const frPendiente = await db.execute(
    "SELECT COUNT(*) n FROM facturas_recibidas WHERE estado_31_12_2025 LIKE 'pendiente%'"
  );
  const frPagada = await db.execute(
    "SELECT COUNT(*) n FROM facturas_recibidas WHERE estado_31_12_2025 LIKE 'pagada%'"
  );
  const frNC = await db.execute(
    "SELECT COUNT(*) n FROM facturas_recibidas WHERE estado_31_12_2025 = 'nota de credito'"
  );
  const frSinDato = await db.execute(
    "SELECT COUNT(*) n FROM facturas_recibidas WHERE estado_31_12_2025 = 'sin dato de pago'"
  );

  console.log("\n--- FR Estado al 31/12/2025 ---");
  console.log("Pagadas:", frPagada.rows[0].n);
  console.log("Pendientes:", frPendiente.rows[0].n);
  console.log("Nota de crédito:", frNC.rows[0].n);
  console.log("Sin dato de pago:", frSinDato.rows[0].n);

  const fePendiente = await db.execute(
    "SELECT COUNT(*) n FROM facturas_emitidas WHERE estado_31_12_2025 LIKE 'pendiente%'"
  );
  const feCobrada = await db.execute(
    "SELECT COUNT(*) n FROM facturas_emitidas WHERE estado_31_12_2025 LIKE 'cobrada%'"
  );
  const feNC = await db.execute(
    "SELECT COUNT(*) n FROM facturas_emitidas WHERE estado_31_12_2025 = 'nota de credito'"
  );
  const feSinDato = await db.execute(
    "SELECT COUNT(*) n FROM facturas_emitidas WHERE estado_31_12_2025 = 'sin dato de cobro'"
  );

  console.log("\n--- FE Estado al 31/12/2025 ---");
  console.log("Cobradas:", feCobrada.rows[0].n);
  console.log("Pendientes:", fePendiente.rows[0].n);
  console.log("Nota de crédito:", feNC.rows[0].n);
  console.log("Sin dato de cobro:", feSinDato.rows[0].n);

  // Saldo pendiente FR
  const saldoFR = await db.execute(
    "SELECT COALESCE(SUM(importe_total),0) s FROM facturas_recibidas WHERE estado_31_12_2025 LIKE 'pendiente%' OR estado_31_12_2025 = 'sin dato de pago'"
  );
  const saldoFE = await db.execute(
    "SELECT COALESCE(SUM(importe_total),0) s FROM facturas_emitidas WHERE estado_31_12_2025 LIKE 'pendiente%' OR estado_31_12_2025 = 'sin dato de cobro'"
  );
  console.log("\nSaldo pendiente FR (pendiente + sin dato):", saldoFR.rows[0].s?.toFixed(2));
  console.log("Saldo pendiente FE (pendiente + sin dato):", saldoFE.rows[0].s?.toFixed(2));

  db.close();
}

console.log("=== ESTADO FACTURAS AL 31/12/2025 ===\n");
await run();
console.log("\n✅ Estado importado.");
