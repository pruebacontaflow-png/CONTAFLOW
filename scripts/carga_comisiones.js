// C.2 — Importar comisiones, proyecciones y presupuesto desde Excel
const XLSX = require("xlsx");
const { createClient } = require("@libsql/client");
const path = require("path");

const dbPath = path.resolve(__dirname, "../contaflow.db").replace(/\\/g, "/");
const db = createClient({ url: `file:/${dbPath}` });

const xlsxPath = path.resolve(__dirname, "../datos/2025/comercial/Comisiones - Time Out ARG.xlsx");

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

async function main() {
  const wb = XLSX.readFile(xlsxPath);

  // ── 1. Config: 10% comisión ────────────────────────────────────────────────
  const existsConfig = await db.execute("SELECT COUNT(*) FROM comisiones_config");
  if (Number(existsConfig.rows[0][0]) === 0) {
    await db.execute({
      sql: `INSERT INTO comisiones_config (descripcion, pct_comision, reparto_igual) VALUES (?,?,?)`,
      args: ["Comercial 10% - repartido entre 2 vendedores", 0.10, 1],
    });
    console.log("✅ comisiones_config: 1 registro insertado");
  } else {
    console.log("ℹ️  comisiones_config: ya tenía registros");
  }

  // ── 2. Tramos de cumplimiento ──────────────────────────────────────────────
  const existsTramos = await db.execute("SELECT COUNT(*) FROM comisiones_tramos");
  if (Number(existsTramos.rows[0][0]) === 0) {
    const tramos = [
      [0, 50, 0,   "< 50%: sin comisión"],
      [50, 80, 50,  "50-80%: 50% de la comisión base"],
      [80, 100, 70, "80-100%: 70% de la comisión base"],
      [100, 999, 100, "> 100%: 100% de la comisión base"],
    ];
    for (const [min, max, pct, notas] of tramos) {
      await db.execute({
        sql: `INSERT INTO comisiones_tramos (pct_cumplimiento_min, pct_cumplimiento_max, pct_aplicar, notas) VALUES (?,?,?,?)`,
        args: [min, max, pct, notas],
      });
    }
    console.log("✅ comisiones_tramos: 4 tramos insertados");
  } else {
    console.log("ℹ️  comisiones_tramos: ya tenía registros");
  }

  // ── 3. Presupuesto comercial 2025 (proyectado vs real) ────────────────────
  const ws2025 = wb.Sheets["Comisiones Comercial - 2025"];
  const dataReal = XLSX.utils.sheet_to_json(ws2025, { header: 1, defval: "" });

  const wsProy2025 = wb.Sheets["Proyección 2025"];
  const dataProy = XLSX.utils.sheet_to_json(wsProy2025, { header: 1, defval: "" });

  // Find column offsets for months in Comisiones 2025 (row 2 header)
  // Row 2 structure: [,,, Enero, Febrero, ...] - first month at col 3
  const headerRow2025 = dataReal[2] || [];
  let mesOffset2025 = -1;
  for (let j = 0; j < headerRow2025.length; j++) {
    if (String(headerRow2025[j]).trim().includes("Enero")) { mesOffset2025 = j; break; }
  }
  if (mesOffset2025 < 0) mesOffset2025 = 3; // fallback

  // Row 2 for Proyección 2025
  const headerRowProy = dataProy[2] || [];
  let mesOffsetProy = -1;
  for (let j = 0; j < headerRowProy.length; j++) {
    if (String(headerRowProy[j]).trim().includes("Enero")) { mesOffsetProy = j; break; }
  }
  if (mesOffsetProy < 0) mesOffsetProy = 1; // fallback

  // Find row indices in Comisiones 2025:
  // Row with "Ingresos" (total area comercial actual)
  // Row with "Gastos Comerciales"
  // Row with "Comisión Comercial 10%"
  let ingresosTotalRow = -1, gastosTotalRow = -1, comisionRow = -1;
  for (let i = 0; i < dataReal.length; i++) {
    const cells = dataReal[i];
    const str = cells.map(c => String(c)).join(" ");
    if (ingresosTotalRow < 0 && str.includes("Ingresos") && i < 10) ingresosTotalRow = i;
    if (gastosTotalRow < 0 && str.includes("Gastos Comerciales") && !str.includes("Total")) gastosTotalRow = i;
    if (comisionRow < 0 && str.includes("Comisi") && str.includes("10%")) comisionRow = i;
    if (comisionRow >= 0 && gastosTotalRow >= 0 && ingresosTotalRow >= 0) break;
  }
  console.log(`\nFinding rows: ingresos=${ingresosTotalRow}, gastos=${gastosTotalRow}, comision=${comisionRow}`);

  // Find row in Proyección 2025 with "Ingresos"
  let proy_ingresosTotalRow = -1;
  for (let i = 0; i < dataProy.length; i++) {
    const str = dataProy[i].map(c => String(c)).join(" ");
    if (str.includes("Ingresos") && i < 6) { proy_ingresosTotalRow = i; break; }
  }
  console.log(`Proyección ingresos row: ${proy_ingresosTotalRow}`);

  // Clear existing presupuesto_comercial for 2025
  await db.execute("DELETE FROM presupuesto_comercial WHERE periodo LIKE '2025-%'");

  let importedPpto = 0;
  for (let m = 0; m < 12; m++) {
    const colReal = mesOffset2025 + m;
    const colProy = mesOffsetProy + m;
    const periodo = `2025-${String(m + 1).padStart(2, "0")}`;

    const ingrReal = ingresosTotalRow >= 0 ? parseFloat(dataReal[ingresosTotalRow][colReal]) || 0 : 0;
    const gastosC = gastosTotalRow >= 0 ? parseFloat(dataReal[gastosTotalRow][colReal]) || 0 : 0;
    const ingrProy = proy_ingresosTotalRow >= 0 ? parseFloat(dataProy[proy_ingresosTotalRow][colProy]) || 0 : 0;

    await db.execute({
      sql: `INSERT INTO presupuesto_comercial (cliente_id, cliente_nombre, periodo, ingresos_proyectados, ingresos_reales, gastos_comerciales)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [null, "Área Comercial Total", periodo, ingrProy, ingrReal, gastosC],
    });
    importedPpto++;
  }
  console.log(`✅ presupuesto_comercial: ${importedPpto} meses 2025 insertados`);

  // ── 4. Comisiones mensuales 2025 (row 105) ───────────────────────────────
  // Insert into comisiones table as monthly commission totals
  // Check if comisiones table has the needed columns
  const tableInfo = await db.execute("PRAGMA table_info(comisiones)");
  const cols = tableInfo.rows.map(r => String(r[1]));
  const hasVendedor = cols.includes("vendedor") || cols.includes("empleado");
  const hasPeriodo = cols.includes("periodo") || cols.includes("mes");

  console.log("\nComisiones table columns:", cols.slice(0, 10).join(", "));

  // Also import 2025 Proyección per client
  // Parse client rows from Proyección 2025 (rows 4+ starting with "- ")
  let importedClientes = 0;
  for (let i = 3; i < dataProy.length; i++) {
    const row = dataProy[i];
    const label = String(row[0] || row[1] || "").trim();
    if (!label.startsWith("-") && !label.startsWith("–")) continue;
    const clienteNombre = label.replace(/^[-–]\s*/, "").trim();
    if (!clienteNombre) continue;

    for (let m = 0; m < 12; m++) {
      const colProy = mesOffsetProy + m;
      const ingrProy = parseFloat(row[colProy]) || 0;
      if (ingrProy === 0) continue;

      const periodo = `2025-${String(m + 1).padStart(2, "0")}`;
      await db.execute({
        sql: `INSERT INTO presupuesto_comercial (cliente_id, cliente_nombre, periodo, ingresos_proyectados, ingresos_reales, gastos_comerciales)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [null, clienteNombre, periodo, ingrProy, 0, 0],
      });
      importedClientes++;
    }
  }

  // Also populate actual amounts from Comisiones 2025 per client (rows 6-30)
  for (let i = 5; i < dataReal.length; i++) {
    const row = dataReal[i];
    const label = String(row[2] || row[1] || "").trim();
    if (!label.startsWith("- ") && !label.startsWith("– ")) break; // end of client section
    if (!label) continue;
    const clienteNombre = label.replace(/^[-–]\s*/, "").trim();
    if (!clienteNombre || clienteNombre.startsWith("Gastos")) break;

    for (let m = 0; m < 12; m++) {
      const colReal = mesOffset2025 + m;
      const ingrReal = parseFloat(row[colReal]) || 0;
      if (ingrReal === 0) continue;

      const periodo = `2025-${String(m + 1).padStart(2, "0")}`;
      // Update existing proy row if exists, else insert
      await db.execute({
        sql: `INSERT INTO presupuesto_comercial (cliente_id, cliente_nombre, periodo, ingresos_proyectados, ingresos_reales, gastos_comerciales)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT DO NOTHING`,
        args: [null, clienteNombre + " (real)", periodo, 0, ingrReal, 0],
      });
      importedClientes++;
    }
  }

  console.log(`✅ presupuesto_comercial clientes: ${importedClientes} celdas con datos`);

  // ── 5. Validation check ───────────────────────────────────────────────────
  if (comisionRow >= 0) {
    const comisiones2025 = dataReal[comisionRow];
    const sep = parseFloat(comisiones2025[mesOffset2025 + 8]) || 0;
    const ago = parseFloat(comisiones2025[mesOffset2025 + 7]) || 0;
    const nov = parseFloat(comisiones2025[mesOffset2025 + 10]) || 0;
    console.log("\n📊 Validación comisiones mensuales (antes de tramo):");
    console.log(`  Sep 2025 base: ${sep.toFixed(0)} (esperado: 1408500)`);
    console.log(`  Ago 2025 base: ${ago.toFixed(0)} (esperado: 1910600 aprox)`);
    console.log(`  Nov 2025 base: ${nov.toFixed(0)} (esperado: 1697500)`);

    // Sep: 77.5% → 50% → 704250
    const pctSep = 0.775;
    const tramoPct = pctSep < 0.5 ? 0 : pctSep < 0.8 ? 0.5 : pctSep < 1.0 ? 0.7 : 1.0;
    const comisionSep = sep * tramoPct;
    console.log(`  Sep comisión ajustada (${(tramoPct*100)}%): ${comisionSep.toFixed(0)} (esperado: 704250)`);
  }

  console.log("\n✅ C.2 completado");
}

main().catch(e => { console.error(e); process.exit(1); });
