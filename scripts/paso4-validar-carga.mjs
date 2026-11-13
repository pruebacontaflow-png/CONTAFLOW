/**
 * Paso 4: Validación de carga 2025
 * Genera docs/validacion-2025.md con resultados detallados
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, parseNum } from "./csvUtils.mjs";
import { writeFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const db = openDB();
const lines = [];
const errores = [];
const advertencias = [];

function h(titulo) { lines.push(`\n## ${titulo}`); }
function ok(msg) { lines.push(`- ✅ ${msg}`); }
function warn(msg) { lines.push(`- ⚠️  ${msg}`); advertencias.push(msg); }
function err(msg) { lines.push(`- ❌ ${msg}`); errores.push(msg); }
function info(msg) { lines.push(`- ${msg}`); }
function sep() { lines.push(""); }

lines.push("# Validación Carga 2025 — IT Click Video S.A.\n");
lines.push(`_Generado: ${new Date().toLocaleString('es-AR')}_\n`);

// 1. Conteos base
h("1. Conteos de registros importados");
const counts = {};
for (const t of ["plan_cuentas","proveedores","clientes","facturas_recibidas",
                  "facturas_emitidas","extractos_lineas","cuentas_bancarias"]) {
  const r = await db.execute(`SELECT COUNT(*) n FROM ${t}`);
  counts[t] = Number(r.rows[0].n);
  info(`${t}: **${counts[t]}** registros`);
}

const esperados = {
  plan_cuentas: 419, proveedores: 116, clientes: 25,
  facturas_recibidas: 829, facturas_emitidas: 158, extractos_lineas: 1538
};
for (const [t, exp] of Object.entries(esperados)) {
  if (counts[t] < exp) err(`${t}: importados ${counts[t]}, esperados ${exp} (faltan ${exp - counts[t]})`);
  else if (counts[t] === exp) ok(`${t}: ${counts[t]} = esperado`);
  else warn(`${t}: importados ${counts[t]} vs esperados ${exp} (hay ${counts[t] - exp} extra)`);
}

// 2. Plan de cuentas
h("2. Plan de Cuentas");
const pClase = await db.execute(
  "SELECT clase, COUNT(*) n FROM plan_cuentas GROUP BY clase ORDER BY n DESC"
);
pClase.rows.forEach(r => info(`${r.clase || "(sin clase)"}: ${r.n} cuentas`));
const sinHabilitar = await db.execute(
  "SELECT COUNT(*) n FROM plan_cuentas WHERE habilitado=0"
);
info(`Sin habilitadas: ${sinHabilitar.rows[0].n}`);
const axi = await db.execute("SELECT COUNT(*) n FROM plan_cuentas WHERE es_axi=1 OR ajuste_inflacion=1");
info(`Cuentas AXI (ajuste inflación): ${axi.rows[0].n}`);

// Cuentas clave
for (const [desc, cod] of [
  ["Proveedores (21101)", "21101"],
  ["IVA Crédito Fiscal (11401)", "11401"],
  ["IVA Débito Fiscal (21401)", "21401"],
  ["Deudores por Ventas (11301)", "11301"],
  ["Banco Credicoop (11154)", "11154"],
]) {
  const r = await db.execute(
    "SELECT id, nombre FROM plan_cuentas WHERE codigo = ?", [cod]
  );
  if (r.rows.length > 0) ok(`Cuenta ${desc}: encontrada (id ${r.rows[0].id})`);
  else err(`Cuenta ${desc}: NO encontrada`);
}

// 3. Proveedores
h("3. Proveedores");
const sinCuenta = await db.execute(
  "SELECT COUNT(*) n FROM proveedores WHERE cuenta_contable_id IS NULL"
);
info(`Sin cuenta_contable_id: ${sinCuenta.rows[0].n}`);
const conCuenta = await db.execute(
  "SELECT COUNT(*) n FROM proveedores WHERE cuenta_contable_id IS NOT NULL"
);
info(`Con cuenta_contable_id: ${conCuenta.rows[0].n}`);

// 4. Facturas recibidas
h("4. Facturas Recibidas");
const frTotales = await db.execute(`
  SELECT
    COUNT(*) n,
    SUM(importe_total) total,
    COUNT(CASE WHEN estado='pagado' THEN 1 END) pagadas,
    COUNT(CASE WHEN moneda!='ARS' THEN 1 END) exterior
  FROM facturas_recibidas`);
const fr = frTotales.rows[0];
info(`Total: ${fr.n} facturas, $${Number(fr.total).toLocaleString('es-AR')}`);
info(`Pagadas: ${fr.pagadas} | Exterior (USD): ${fr.exterior}`);

const frSinProveedor = await db.execute(
  "SELECT COUNT(*) n FROM facturas_recibidas fr LEFT JOIN proveedores p ON fr.proveedor_id=p.id WHERE p.id IS NULL"
);
if (Number(frSinProveedor.rows[0].n) > 0)
  err(`Facturas sin proveedor válido: ${frSinProveedor.rows[0].n}`);
else ok("Todas las facturas tienen proveedor");

// Comparar con ARCA CSV
const arcaFile = path.join(ROOT, "datos/2025/origen");
const arcaFiles = existsSync(arcaFile) ? readdirSync(arcaFile).filter(f => f.includes("recibidos") && f.endsWith(".csv")) : [];
if (arcaFiles.length > 0) {
  const arcaPath = path.join(arcaFile, arcaFiles[0]);
  try {
    const arcaRows = parseCSV(arcaPath);
    info(`ARCA CSV recibidos: ${arcaRows.length} registros en ${arcaFiles[0]}`);
    if (Math.abs(arcaRows.length - counts.facturas_recibidas) > 15)
      warn(`Diferencia ARCA vs importadas: ${arcaRows.length} vs ${counts.facturas_recibidas}`);
  } catch {}
}

// 5. Facturas emitidas
h("5. Facturas Emitidas");
const feTotales = await db.execute(`
  SELECT COUNT(*) n, SUM(importe_total) total,
    COUNT(CASE WHEN estado='cobrado' THEN 1 END) cobradas
  FROM facturas_emitidas`);
const fe = feTotales.rows[0];
info(`Total: ${fe.n} facturas, $${Number(fe.total).toLocaleString('es-AR')}`);
info(`Cobradas: ${fe.cobradas}`);

// 6. Extracto bancario
h("6. Extracto Bancario Credicoop");
const extTotal = await db.execute(`
  SELECT COUNT(*) n, SUM(debito) deb, SUM(credito) cred
  FROM extractos_lineas`);
const ext = extTotal.rows[0];
info(`Movimientos: ${ext.n}`);
info(`Total débitos: $${Number(ext.deb).toLocaleString('es-AR')}`);
info(`Total créditos: $${Number(ext.cred).toLocaleString('es-AR')}`);

const sinCuentaExt = await db.execute(
  "SELECT COUNT(*) n FROM extractos_lineas WHERE cuenta_contable_id IS NULL"
);
warn(`Sin cuenta_contable_id: ${sinCuentaExt.rows[0].n} (incluye 172 sin cuenta_tango + no resueltos)`);

const dosCuentasExt = await db.execute(
  "SELECT COUNT(*) n FROM extractos_lineas WHERE tiene_dos_cuentas=1"
);
info(`Con dos cuentas Tango: ${dosCuentasExt.rows[0].n} (pendiente de asignación manual)`);

// Verificar saldo
const bancoRes = await db.execute(
  "SELECT saldo_actual FROM cuentas_bancarias WHERE banco LIKE '%Credicoop%' LIMIT 1"
);
if (bancoRes.rows.length > 0) {
  const saldo = Number(bancoRes.rows[0].saldo_actual);
  const esperadoSaldo = 23418251.19;
  const diff = Math.abs(saldo - esperadoSaldo);
  if (diff < 1) ok(`Saldo Credicoop: $${saldo.toLocaleString('es-AR')} = esperado`);
  else warn(`Saldo Credicoop: $${saldo.toLocaleString('es-AR')} (esperado $${esperadoSaldo.toLocaleString('es-AR')}, diff $${diff.toFixed(2)})`);
}

// 7. Extracto por mes
h("7. Movimientos por mes");
const porMes = await db.execute(`
  SELECT substr(fecha,1,7) mes, COUNT(*) n, MIN(saldo) smin, MAX(saldo) smax
  FROM extractos_lineas GROUP BY mes ORDER BY mes`);
porMes.rows.forEach(r => info(
  `${r.mes}: ${r.n} mov, saldo min/max: $${Number(r.smin).toLocaleString('es-AR')} / $${Number(r.smax).toLocaleString('es-AR')}`
));

// 8. Parámetros configurados
h("8. Parámetros contables");
const params = await db.execute(
  "SELECT clave, valor FROM parametros WHERE clave LIKE 'cuenta_%' OR clave LIKE 'banco_%' ORDER BY clave"
);
for (const p of params.rows) {
  const r = await db.execute(
    "SELECT codigo, nombre FROM plan_cuentas WHERE id=? UNION SELECT '', banco FROM cuentas_bancarias WHERE id=?",
    [p.valor, p.valor]
  );
  const detalle = r.rows.length > 0 ? `${r.rows[0].codigo || ""} ${r.rows[0].nombre || r.rows[0].banco || ""}`.trim() : "?";
  ok(`${p.clave} = id ${p.valor} (${detalle})`);
}

// 9. Resumen final
h("9. Resumen");
info(`Errores: **${errores.length}**`);
info(`Advertencias: **${advertencias.length}**`);
if (errores.length > 0) {
  lines.push("\n### Errores a resolver:");
  errores.forEach(e => lines.push(`- ❌ ${e}`));
}
if (advertencias.length > 0) {
  lines.push("\n### Advertencias:");
  advertencias.forEach(a => lines.push(`- ⚠️  ${a}`));
}

const md = lines.join("\n");
const outPath = path.join(ROOT, "docs/validacion-2025.md");
writeFileSync(outPath, md, "utf-8");
console.log(`\n✅ Validación guardada en: ${outPath}`);
console.log(`   Errores: ${errores.length} | Advertencias: ${advertencias.length}`);

db.close();
process.exit(errores.length > 0 ? 1 : 0);
