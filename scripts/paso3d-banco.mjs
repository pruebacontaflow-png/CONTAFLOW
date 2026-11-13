/**
 * Paso 3d: Crear cuenta bancaria Credicoop y configurar parametros
 * Saldo inicial: $7.906.085,63 (01/01/2025)
 */
import { openDB } from "./dbUtils.mjs";

const db = openDB();

// Buscar cuenta 11154 en plan_cuentas (Banco Credicoop)
const cuentaRes = await db.execute(
  "SELECT id, nombre FROM plan_cuentas WHERE codigo = '11154'"
);
const cuentaContableId = cuentaRes.rows.length > 0 ? cuentaRes.rows[0].id : null;
const cuentaNombre = cuentaRes.rows.length > 0 ? cuentaRes.rows[0].nombre : "Banco Credicoop";
console.log(`Cuenta contable 11154: id=${cuentaContableId}, nombre=${cuentaNombre}`);

// Crear cuenta bancaria Credicoop
const exBanco = await db.execute(
  "SELECT id FROM cuentas_bancarias WHERE banco LIKE '%Credicoop%'"
);
let bancoCuenta;
if (exBanco.rows.length > 0) {
  bancoCuenta = exBanco.rows[0].id;
  await db.execute(`UPDATE cuentas_bancarias SET
    banco='Banco Credicoop — IT Click', tipo='Cuenta Corriente', moneda='ARS',
    saldo_actual=7906085.63, cuenta_contable_id=?, numero_cuenta=''
    WHERE id=?`, [cuentaContableId, bancoCuenta]);
  console.log(`Cuenta Credicoop actualizada (id=${bancoCuenta})`);
} else {
  const r = await db.execute(`INSERT INTO cuentas_bancarias
    (banco, tipo, moneda, saldo_actual, cuenta_contable_id, numero_cuenta)
    VALUES ('Banco Credicoop — IT Click','Cuenta Corriente','ARS',7906085.63,?,?)`,
    [cuentaContableId, ""]);
  bancoCuenta = r.lastInsertRowid;
  console.log(`Cuenta Credicoop creada (id=${bancoCuenta})`);
}

// Función para buscar cuenta por código y guardar en parametros
async function setParam(clave, codigoCuenta) {
  const r = await db.execute(
    "SELECT id FROM plan_cuentas WHERE codigo = ?", [codigoCuenta]
  );
  if (r.rows.length === 0) {
    console.warn(`  ⚠️  Código ${codigoCuenta} no encontrado para parámetro ${clave}`);
    return;
  }
  const id = r.rows[0].id;
  await db.execute(
    "INSERT OR REPLACE INTO parametros (clave, valor) VALUES (?,?)",
    [clave, String(id)]
  );
  console.log(`  ${clave} = id ${id} (código ${codigoCuenta})`);
}

console.log("\nConfigurando parámetros contables:");
// Mapeo clave → código Tango según instrucción del usuario
await setParam("cuenta_proveedores_id", "21101");       // Proveedores
await setParam("cuenta_iva_credito_id", "11401");       // IVA Crédito Fiscal
await setParam("cuenta_iva_debito_id", "21401");        // IVA Débito Fiscal
await setParam("cuenta_clientes_id", "11301");          // Deudores por Ventas
await setParam("cuenta_banco_principal_id", "11154");   // Banco Credicoop
await setParam("cuenta_ret_ganancias_id", "21410");     // Retenciones Ganancias a depositar
await setParam("cuenta_ret_iibb_id", "21411");          // IIBB a pagar

// Parámetro del banco para el extracto
await db.execute(
  "INSERT OR REPLACE INTO parametros (clave, valor) VALUES (?,?)",
  ["banco_principal_id", String(bancoCuenta)]
);
console.log(`  banco_principal_id = ${bancoCuenta}`);

db.close();
console.log("\n✅ Cuenta bancaria y parámetros configurados.");
