/**
 * Paso 3b: Importar proveedores (116) con cuenta_tango → cuenta_contable_id
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV } from "./csvUtils.mjs";

const ARCHIVO = "datos/2025/importar/proveedores.csv";
const rows = parseCSV(ARCHIVO);
console.log(`Leyendo ${rows.length} proveedores de ${ARCHIVO}...`);

const db = openDB();

// Mapa nombre → id en plan_cuentas
const cuentasRes = await db.execute("SELECT id, nombre FROM plan_cuentas");
const cuentasPorNombre = {};
for (const c of cuentasRes.rows) {
  cuentasPorNombre[(c.nombre || "").trim().toLowerCase()] = c.id;
}

let ins = 0, upd = 0, err = 0, sinCuenta = 0;

for (const r of rows) {
  const cuit = (r.cuit || "").trim();
  const razon_social = (r.razon_social || "").trim();
  if (!cuit || !razon_social) continue;

  const cuenta_tango = (r.cuenta_tango || "").trim();
  let cuenta_contable_id = null;
  if (cuenta_tango) {
    cuenta_contable_id = cuentasPorNombre[cuenta_tango.toLowerCase()] ?? null;
    if (!cuenta_contable_id) {
      sinCuenta++;
      // Buscar también por código
      const byCode = await db.execute(
        "SELECT id FROM plan_cuentas WHERE codigo = ?", [cuenta_tango]
      );
      if (byCode.rows.length > 0) cuenta_contable_id = byCode.rows[0].id;
    }
  }

  const condicion_iva = (r.condicion_iva || "Responsable Inscripto").trim();

  try {
    const ex = await db.execute("SELECT id FROM proveedores WHERE cuit = ?", [cuit]);
    if (ex.rows.length > 0) {
      await db.execute(`UPDATE proveedores SET
        razon_social=?, condicion_iva=?, direccion=?, telefono=?, email=?,
        contacto=?, nombre_en_cxp=?, cbu=?, servicio=?, cuenta_contable_id=?,
        activo=1
        WHERE cuit=?`,
        [razon_social, condicion_iva,
         r.direccion || "", r.telefono || "", r.email || "",
         r.contacto || "", r.nombre_en_cxp || "", r.cbu || "",
         r.servicio || "", cuenta_contable_id, cuit]);
      upd++;
    } else {
      await db.execute(`INSERT INTO proveedores
        (cuit, razon_social, condicion_iva, direccion, telefono, email,
         contacto, nombre_en_cxp, cbu, servicio, cuenta_contable_id, activo)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`,
        [cuit, razon_social, condicion_iva,
         r.direccion || "", r.telefono || "", r.email || "",
         r.contacto || "", r.nombre_en_cxp || "", r.cbu || "",
         r.servicio || "", cuenta_contable_id]);
      ins++;
    }
  } catch (e) {
    console.error(`  ERROR ${cuit}: ${e.message}`);
    err++;
  }
}

const total = await db.execute("SELECT COUNT(*) n FROM proveedores");
console.log(`\n✅ Proveedores: ${ins} insertados, ${upd} actualizados, ${err} errores`);
console.log(`   Sin cuenta_contable_id resuelta: ${sinCuenta}`);
console.log(`   Total en DB: ${total.rows[0].n}`);
db.close();
