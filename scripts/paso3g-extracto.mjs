/**
 * Paso 3g: Importar extracto bancario Credicoop 2025 (1.538 movimientos)
 * - 1.366 con cuenta_tango → resuelve a cuenta_contable_id
 * - 172 sin cuenta → queda sin resolver (pendiente)
 * - 11 con dos cuentas → tiene_dos_cuentas=1, se guarda la primera
 * - Saldo inicial: $7.906.085,63
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, parseFecha, parseNum } from "./csvUtils.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHIVO = "datos/2025/importar/extracto-credicoop-2025.csv";

const rows = parseCSV(ARCHIVO);
console.log(`Leyendo ${rows.length} movimientos de extracto...`);

const db = openDB();

// Buscar o crear extracto_bancarios header para Credicoop 2025
const bancoRes = await db.execute(
  "SELECT id FROM cuentas_bancarias WHERE banco LIKE '%Credicoop%' LIMIT 1"
);
const cuenta_bancaria_id = bancoRes.rows.length > 0 ? bancoRes.rows[0].id : 1;

// Chequear si ya existe un extracto para 2025
let extractoId;
const exExtracto = await db.execute(
  "SELECT id FROM extractos_bancarios WHERE origen='historico_2025' LIMIT 1"
);
if (exExtracto.rows.length > 0) {
  extractoId = exExtracto.rows[0].id;
  console.log(`Reutilizando extracto id=${extractoId}`);
} else {
  const r = await db.execute(`INSERT INTO extractos_bancarios
    (cuenta_bancaria_id, fecha_desde, fecha_hasta, nombre_archivo,
     saldo_inicial, saldo_final, origen)
    VALUES (?,?,?,?,?,?,?)`,
    [cuenta_bancaria_id, "2025-01-01", "2025-12-31",
     "extracto-credicoop-2025.csv",
     7906085.63, 23418251.19, "historico_2025"]);
  extractoId = Number(r.lastInsertRowid);
  console.log(`Extracto creado id=${extractoId}`);
}

// Mapa código Tango → cuenta_contable_id
const cuentasRes = await db.execute("SELECT id, codigo FROM plan_cuentas");
const cuentasPorCodigo = {};
for (const c of cuentasRes.rows) cuentasPorCodigo[(c.codigo || "").trim()] = c.id;

let ins = 0, sinCuenta = 0, dosCuentas = 0, err = 0;
let saldoFinal = 7906085.63;

for (const r of rows) {
  const fecha = parseFecha(r.fecha);
  if (!fecha) continue;

  const debito = parseNum(r.debito);
  const credito = parseNum(r.credito);
  const saldo = parseNum(r.saldo);
  const descripcion = (r.descripcion || "").trim();
  const nro_comprobante = (r.nro_comprobante || "").trim();
  const codigo_banco = (r.codigo_banco || "").trim();
  const comentario = (r.comentario || "").trim();
  const linea_negocio = (r.linea_negocio || "").trim();
  const comentario_ro = (r.comentario_ro || "").trim();
  const cuenta_tango_raw = (r.cuenta_tango || "").trim();

  // Detectar dos cuentas
  const esDual = /^\d+\s+y\s+\d+$/.test(cuenta_tango_raw);
  const tiene_dos_cuentas = esDual ? 1 : 0;

  let cuenta_tango = cuenta_tango_raw;
  let cuenta_contable_id = null;

  if (cuenta_tango_raw) {
    if (esDual) {
      dosCuentas++;
      // Guardar solo la primera cuenta
      cuenta_tango = cuenta_tango_raw.split(/\s+y\s+/)[0].trim();
    }
    cuenta_contable_id = cuentasPorCodigo[cuenta_tango] ?? null;
    if (!cuenta_contable_id) sinCuenta++;
  } else {
    sinCuenta++;
  }

  if (saldo) saldoFinal = saldo;

  try {
    await db.execute(`INSERT INTO extractos_lineas (
      extracto_id, fecha, descripcion, referencia,
      debito, credito, saldo,
      cuenta_contable_id, cuenta_tango,
      nro_comprobante, codigo_banco,
      comentario, linea_negocio, comentario_ro,
      tiene_dos_cuentas, conciliado, origen
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
    [extractoId, fecha, descripcion, nro_comprobante,
     debito, credito, saldo,
     cuenta_contable_id, cuenta_tango_raw,
     nro_comprobante, codigo_banco,
     comentario, linea_negocio, comentario_ro,
     tiene_dos_cuentas, "historico_2025"]);
    ins++;
  } catch (e) {
    console.error(`  ERROR ${fecha} ${descripcion.slice(0,30)}: ${e.message}`);
    err++;
  }
}

// Actualizar saldo final de la cuenta bancaria
await db.execute(
  "UPDATE cuentas_bancarias SET saldo_actual=? WHERE id=?",
  [saldoFinal, cuenta_bancaria_id]
);

const total = await db.execute("SELECT COUNT(*) n FROM extractos_lineas");
console.log(`\n✅ Extracto: ${ins} movimientos importados, ${err} errores`);
console.log(`   Sin cuenta_contable_id: ${sinCuenta}`);
console.log(`   Con dos cuentas Tango: ${dosCuentas}`);
console.log(`   Saldo final Credicoop: $${saldoFinal.toLocaleString('es-AR')}`);
console.log(`   Total en DB: ${total.rows[0].n}`);

// Resumen por mes
const porMes = await db.execute(`
  SELECT substr(fecha,1,7) mes, COUNT(*) n,
    SUM(debito) deb, SUM(credito) cred
  FROM extractos_lineas WHERE extracto_id=?
  GROUP BY mes ORDER BY mes`,
  [extractoId]);
console.log("\n   Por mes:");
porMes.rows.forEach(r => console.log(
  `   ${r.mes}: ${r.n} mov (D:$${Number(r.deb).toLocaleString('es-AR')} / H:$${Number(r.cred).toLocaleString('es-AR')})`
));

db.close();
