/**
 * Reporte de validación de los datos cargados en ContaFlow.
 * Verifica integridad, coherencia y completitud de los datos 2025.
 * Uso: node scripts/validar-datos-2025.mjs
 */
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbFile = path.resolve(__dirname, "../contaflow.db");
const db = createClient({ url: `file:/${dbFile.replace(/\\/g, "/")}` });

const ANIO = 2025;

let errores = 0;
let advertencias = 0;

function ok(msg)   { console.log(`  ✓ ${msg}`); }
function err(msg)  { console.log(`  ✗ ${msg}`); errores++; }
function warn(msg) { console.log(`  ⚠ ${msg}`); advertencias++; }
function section(title) { console.log(`\n══════════ ${title} ══════════`); }

// ─── 1. Tablas esenciales ────────────────────────────────────────────────────
section("1. TABLAS ESENCIALES");
const REQUIRED_TABLES = [
  "proveedores","clientes","facturas_recibidas","facturas_emitidas",
  "cuentas_bancarias","extractos_bancarios","extractos_lineas",
  "ordenes_pago","ordenes_pago_items","retenciones_aplicadas",
  "retenciones_config","plan_cuentas","periodos_contables",
  "asientos","asientos_lineas","facturas_iva_detalle",
  "parametros","retenciones_acumulado","auditoria","drive_sync_log",
];
const allTables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`);
const tableSet = new Set(allTables.rows.map(r => String(r.name)));
for (const t of REQUIRED_TABLES) {
  if (tableSet.has(t)) ok(t);
  else err(`Tabla faltante: ${t}`);
}

// ─── 2. Proveedores ─────────────────────────────────────────────────────────
section("2. PROVEEDORES");
const provTotal = await db.execute(`SELECT COUNT(*) n FROM proveedores`);
const provN = Number(provTotal.rows[0].n);
console.log(`  Total: ${provN}`);
if (provN === 0) err("Sin proveedores cargados");
else if (provN < 5) warn("Menos de 5 proveedores — verificar que estén todos");
else ok(`${provN} proveedores`);

// CUITs duplicados
const dupCuits = await db.execute(
  `SELECT cuit, COUNT(*) n FROM proveedores GROUP BY cuit HAVING n > 1`
);
if (dupCuits.rows.length > 0) {
  dupCuits.rows.forEach(r => err(`CUIT duplicado en proveedores: ${r.cuit}`));
} else ok("Sin CUITs duplicados");

// Proveedores con CUIT inválido (formato xx-xxxxxxxx-x)
const invCuit = await db.execute(
  `SELECT cuit, razon_social FROM proveedores WHERE cuit NOT LIKE '__-________-_'`
);
if (invCuit.rows.length > 0) {
  invCuit.rows.forEach(r => warn(`CUIT con formato inusual: ${r.cuit} (${r.razon_social})`));
}

// ─── 3. Facturas Recibidas ───────────────────────────────────────────────────
section("3. FACTURAS RECIBIDAS 2025");
const frTotal = await db.execute(
  `SELECT COUNT(*) n, SUM(importe_total) suma, MIN(fecha_emision) min_f, MAX(fecha_emision) max_f
   FROM facturas_recibidas WHERE strftime('%Y', fecha_emision) = '${ANIO}'`
);
const frRow = frTotal.rows[0];
const frN = Number(frRow.n);
const frSuma = Number(frRow.suma || 0);
console.log(`  Total: ${frN} facturas, $${frSuma.toLocaleString("es-AR")}`);
console.log(`  Rango: ${frRow.min_f || "(vacío)"} → ${frRow.max_f || "(vacío)"}`);
if (frN === 0) warn("Sin facturas recibidas 2025");
else ok(`${frN} facturas recibidas`);

// Facturas sin proveedor_id válido
const frSinProv = await db.execute(
  `SELECT COUNT(*) n FROM facturas_recibidas fr
   LEFT JOIN proveedores p ON fr.proveedor_id = p.id
   WHERE p.id IS NULL AND strftime('%Y', fr.fecha_emision) = '${ANIO}'`
);
if (Number(frSinProv.rows[0].n) > 0)
  err(`${frSinProv.rows[0].n} facturas recibidas con proveedor_id inválido`);
else ok("Todas las facturas tienen proveedor válido");

// Facturas con importe_total <= 0
const frCero = await db.execute(
  `SELECT COUNT(*) n FROM facturas_recibidas WHERE importe_total <= 0 AND strftime('%Y', fecha_emision) = '${ANIO}'`
);
if (Number(frCero.rows[0].n) > 0)
  warn(`${frCero.rows[0].n} facturas con importe <= 0`);

// Distribución mensual
const frMeses = await db.execute(
  `SELECT strftime('%m', fecha_emision) mes, COUNT(*) n, SUM(importe_total) suma
   FROM facturas_recibidas WHERE strftime('%Y', fecha_emision) = '${ANIO}'
   GROUP BY mes ORDER BY mes`
);
if (frMeses.rows.length > 0) {
  console.log("  Distribución mensual:");
  frMeses.rows.forEach(r =>
    console.log(`    ${r.mes}/2025: ${r.n} facturas, $${Number(r.suma).toLocaleString("es-AR")}`)
  );
}

// ─── 4. Facturas Emitidas ────────────────────────────────────────────────────
section("4. FACTURAS EMITIDAS 2025");
const feTotal = await db.execute(
  `SELECT COUNT(*) n, SUM(importe_total) suma FROM facturas_emitidas WHERE strftime('%Y', fecha_emision) = '${ANIO}'`
);
const feN = Number(feTotal.rows[0].n);
console.log(`  Total: ${feN} facturas, $${Number(feTotal.rows[0].suma || 0).toLocaleString("es-AR")}`);
if (feN === 0) warn("Sin facturas emitidas 2025");
else ok(`${feN} facturas emitidas`);

// ─── 5. Extractos Bancarios ─────────────────────────────────────────────────
section("5. EXTRACTOS BANCARIOS 2025");
const extTotal = await db.execute(`SELECT COUNT(*) n FROM extractos_bancarios`);
const movTotal = await db.execute(
  `SELECT COUNT(*) n, SUM(debito + credito) suma FROM extractos_lineas
   WHERE strftime('%Y', fecha) = '${ANIO}'`
);
const extN = Number(extTotal.rows[0].n);
const movN = Number(movTotal.rows[0].n);
console.log(`  Extractos cargados: ${extN}`);
console.log(`  Movimientos 2025: ${movN}, monto total: $${Number(movTotal.rows[0].suma||0).toLocaleString("es-AR")}`);
if (extN === 0) warn("Sin extractos bancarios cargados");
else ok(`${extN} archivos de extracto`);

// Movimientos sin conciliar
const sinConc = await db.execute(
  `SELECT COUNT(*) n FROM extractos_lineas
   WHERE (conciliado IS NULL OR conciliado=0) AND strftime('%Y', fecha)='${ANIO}'`
);
if (Number(sinConc.rows[0].n) > 0)
  warn(`${sinConc.rows[0].n} movimientos sin conciliar en 2025`);

// ─── 6. Órdenes de Pago ─────────────────────────────────────────────────────
section("6. ÓRDENES DE PAGO 2025");
const opTotal = await db.execute(
  `SELECT COUNT(*) n,
          SUM(COALESCE(importe_bruto, importe_neto, 0)) suma
   FROM ordenes_pago WHERE strftime('%Y', fecha) = '${ANIO}'`
);
const opN = Number(opTotal.rows[0].n);
console.log(`  Total: ${opN} órdenes, $${Number(opTotal.rows[0].suma||0).toLocaleString("es-AR")}`);
if (opN === 0) warn("Sin órdenes de pago 2025");
else ok(`${opN} órdenes de pago`);

// ─── 7. Asientos Contables ───────────────────────────────────────────────────
section("7. ASIENTOS CONTABLES");
const asTotal = await db.execute(
  `SELECT COUNT(*) n FROM asientos WHERE strftime('%Y', fecha) = '${ANIO}'`
);
const asN = Number(asTotal.rows[0].n);
console.log(`  Total asientos 2025: ${asN}`);
if (asN === 0) warn("Sin asientos contables en 2025");
else ok(`${asN} asientos`);

// Asientos descuadrados (debe ≠ haber, tolerancia $0.01)
const descuadrados = await db.execute(
  `SELECT a.id, a.fecha,
          ROUND(SUM(al.debe),2) total_debe,
          ROUND(SUM(al.haber),2) total_haber
   FROM asientos a
   JOIN asientos_lineas al ON al.asiento_id = a.id
   WHERE strftime('%Y', a.fecha) = '${ANIO}'
   GROUP BY a.id
   HAVING ABS(total_debe - total_haber) > 0.01`
);
if (descuadrados.rows.length > 0) {
  err(`${descuadrados.rows.length} asientos descuadrados:`);
  descuadrados.rows.slice(0,5).forEach(r =>
    console.log(`    ID ${r.id} (${r.fecha}): debe=${r.total_debe}, haber=${r.total_haber}`)
  );
} else ok("Todos los asientos cuadrados");

// ─── 8. Retenciones ──────────────────────────────────────────────────────────
section("8. RETENCIONES");
const retConf = await db.execute(`SELECT COUNT(*) n FROM retenciones_config WHERE activo=1 OR activo IS NULL`);
console.log(`  Regímenes activos: ${retConf.rows[0].n}`);
if (Number(retConf.rows[0].n) === 0) warn("Sin regímenes de retención configurados");
else ok(`${retConf.rows[0].n} regímenes`);

// retenciones_aplicadas no tiene created_at — usar join con ordenes_pago
const retTotal = await db.execute(
  `SELECT COUNT(*) n, SUM(ra.importe) suma
   FROM retenciones_aplicadas ra
   JOIN ordenes_pago op ON ra.orden_pago_id = op.id
   WHERE strftime('%Y', op.fecha) = '${ANIO}'`
);
console.log(`  Retenciones aplicadas 2025: ${retTotal.rows[0].n}, $${Number(retTotal.rows[0].suma||0).toLocaleString("es-AR")}`);

// ─── 9. Períodos contables ───────────────────────────────────────────────────
section("9. PERÍODOS CONTABLES");
const periodos = await db.execute(
  `SELECT anio, mes, cerrado FROM periodos_contables WHERE anio=${ANIO} ORDER BY mes`
);
if (periodos.rows.length === 0) {
  warn("Sin períodos contables creados para 2025 — se crean automáticamente al operar");
} else {
  const abiertos = periodos.rows.filter(p => !p.cerrado).length;
  const cerrados = periodos.rows.filter(p => p.cerrado).length;
  console.log(`  Períodos 2025: ${periodos.rows.length} (${abiertos} abiertos, ${cerrados} cerrados)`);
  periodos.rows.forEach(p =>
    console.log(`    ${p.anio}-${String(p.mes).padStart(2,"0")} ${p.cerrado ? "cerrado" : "abierto"}`)
  );
}

// ─── 10. Plan de Cuentas ─────────────────────────────────────────────────────
section("10. PLAN DE CUENTAS");
const planTotal = await db.execute(`SELECT COUNT(*) n FROM plan_cuentas`);
const planN = Number(planTotal.rows[0].n);
console.log(`  Cuentas: ${planN}`);
if (planN === 0) err("Sin plan de cuentas — cargalo desde /plan-cuentas");
else if (planN < 20) warn(`Solo ${planN} cuentas — verificar que esté completo`);
else ok(`${planN} cuentas en el plan`);

// ─── 11. Usuarios ────────────────────────────────────────────────────────────
section("11. USUARIOS");
const usrTotal = await db.execute(`SELECT COUNT(*) n, rol FROM usuarios WHERE activo=1 GROUP BY rol`);
usrTotal.rows.forEach(r => console.log(`  ${r.rol}: ${r.n}`));
const admins = usrTotal.rows.filter(r => r.rol === "admin").length;
if (admins === 0) err("Sin usuarios admin activos");
else ok("Al menos un admin activo");

// Usuarios con rol proveedor (deberían estar desactivados)
const provUsers = await db.execute(`SELECT COUNT(*) n FROM usuarios WHERE rol='proveedor' AND activo=1`);
if (Number(provUsers.rows[0].n) > 0)
  warn(`${provUsers.rows[0].n} usuarios proveedor todavía activos — desactivar desde /usuarios`);

// ─── RESUMEN ─────────────────────────────────────────────────────────────────
section("RESUMEN");
if (errores === 0 && advertencias === 0) {
  console.log("  ✅ TODO OK — base de datos en buen estado");
} else {
  console.log(`  Errores: ${errores} | Advertencias: ${advertencias}`);
  if (errores > 0) console.log("  ⚠ Corregir errores antes de operar en producción");
}

db.close();
