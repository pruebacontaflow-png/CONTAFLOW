/**
 * Insertar proveedores sin CUIT del CSV de proveedores
 * PILAR TAPIA: ya insertada automáticamente por paso3e (Invoice exterior, cuit='')
 * TECSER: sin CUIT ni facturas → insertar con placeholder
 */
import { openDB } from "./dbUtils.mjs";
const db = openDB();

// Buscar PILAR TAPIA (cuit vacío, creada en paso3e)
const pilar = await db.execute(
  "SELECT id FROM proveedores WHERE razon_social LIKE '%PILAR TAPIA%'"
);
if (pilar.rows.length > 0) {
  // Actualizar con CBU y datos del CSV
  await db.execute(`UPDATE proveedores SET
    nombre_en_cxp='PILAR TAPIA', condicion_iva='Del exterior', activo=1
    WHERE id=?`, [pilar.rows[0].id]);
  console.log("✅ PILAR TAPIA actualizada (id", pilar.rows[0].id, ")");
} else {
  await db.execute(
    "INSERT INTO proveedores (cuit, razon_social, nombre_en_cxp, condicion_iva, activo) VALUES (?,?,?,?,1)",
    ["", "PILAR TAPIA", "PILAR TAPIA", "Del exterior"]
  );
  console.log("✅ PILAR TAPIA insertada");
}

// TECSER: sin facturas, sin CUIT
const tecser = await db.execute(
  "SELECT id FROM proveedores WHERE razon_social LIKE '%TECSER%'"
);
if (tecser.rows.length === 0) {
  await db.execute(
    "INSERT INTO proveedores (cuit, razon_social, nombre_en_cxp, condicion_iva, servicio, activo) VALUES (?,?,?,?,?,1)",
    ["SIN-CUIT-TECSER", "TECSER", "TECSER", "Responsable Inscripto", "Otros gastos de administracion"]
  );
  console.log("✅ TECSER insertada (placeholder CUIT=SIN-CUIT-TECSER)");
} else {
  console.log("TECSER ya existe (id", tecser.rows[0].id, ")");
}

const total = await db.execute("SELECT COUNT(*) n FROM proveedores");
console.log("Total proveedores:", total.rows[0].n);
db.close();
