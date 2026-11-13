/**
 * Paso 3a: Importar plan de cuentas Tango (419 cuentas)
 * Detecta cuentas AXI (ajuste_inflacion=Si → es_axi=1)
 * Mapea clase Tango → tipo ContaFlow
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV, siNo } from "./csvUtils.mjs";

const ARCHIVO = "datos/2025/importar/plan-cuentas-tango.csv";

function claseATipo(clase) {
  const c = (clase || "").toLowerCase();
  if (c === "activo") return "activo";
  if (c === "pasivo") return "pasivo";
  if (c.includes("patrimonio")) return "patrimonio";
  if (c.includes("positivo") || c.includes("ingreso")) return "ingreso";
  if (c.includes("negativo") || c.includes("costo") || c.includes("gasto")) return "egreso";
  if (c.includes("resultado") || c.includes("acumulado")) return "resultado";
  return "egreso";
}

const rows = parseCSV(ARCHIVO);
console.log(`Leyendo ${rows.length} cuentas de ${ARCHIVO}...`);

const db = openDB();
let ins = 0, upd = 0, err = 0;

for (const r of rows) {
  const codigo = (r.codigo || "").trim();
  if (!codigo) continue;

  const nombre = (r.nombre || "").trim();
  const clase = (r.clase || "").trim();
  const tipo = claseATipo(clase);
  const saldo_habitual = (r.saldo_habitual || "").trim();
  const habilitado = siNo(r.habilitado);
  const ajuste_inflacion = siNo(r.ajuste_inflacion);
  const afecta_conversion = siNo(r.afecta_conversion);
  const resultado_tenencia = siNo(r.resultado_tenencia);
  const unidad_adicional = siNo(r.unidad_adicional);
  // AXI = tiene ajuste_inflacion OR código de 6 dígitos terminado en 1 con base en tabla
  const es_axi = ajuste_inflacion;
  // Imputable = cuentas habilitadas
  const imputable = habilitado;

  try {
    const existing = await db.execute(
      "SELECT id FROM plan_cuentas WHERE codigo = ?", [codigo]
    );
    if (existing.rows.length > 0) {
      await db.execute(`UPDATE plan_cuentas SET
        nombre=?, tipo=?, clase=?, saldo_habitual=?, habilitado=?,
        ajuste_inflacion=?, afecta_conversion=?, resultado_tenencia=?,
        unidad_adicional=?, es_axi=?, imputable=?, activo=?
        WHERE codigo=?`,
        [nombre, tipo, clase, saldo_habitual, habilitado,
         ajuste_inflacion, afecta_conversion, resultado_tenencia,
         unidad_adicional, es_axi, imputable, habilitado, codigo]);
      upd++;
    } else {
      await db.execute(`INSERT INTO plan_cuentas
        (codigo, nombre, tipo, subtipo, clase, saldo_habitual, habilitado,
         ajuste_inflacion, afecta_conversion, resultado_tenencia,
         unidad_adicional, es_axi, imputable, activo)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [codigo, nombre, tipo, clase, clase, saldo_habitual, habilitado,
         ajuste_inflacion, afecta_conversion, resultado_tenencia,
         unidad_adicional, es_axi, imputable, habilitado]);
      ins++;
    }
  } catch (e) {
    console.error(`  ERROR ${codigo}: ${e.message}`);
    err++;
  }
}

const total = await db.execute("SELECT COUNT(*) n FROM plan_cuentas");
console.log(`\n✅ Plan de cuentas: ${ins} insertadas, ${upd} actualizadas, ${err} errores`);
console.log(`   Total en DB: ${total.rows[0].n} cuentas`);

// Verificar por clase
const pClase = await db.execute(
  "SELECT clase, COUNT(*) n FROM plan_cuentas GROUP BY clase ORDER BY n DESC"
);
console.log("\n   Por clase:");
pClase.rows.forEach(r => console.log(`   ${r.clase || "(sin clase)"}: ${r.n}`));

db.close();
