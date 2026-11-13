/**
 * BLOQUE 1 — Importar proveedores-maestro.csv
 * Columnas CSV: codigo_proveedor, cuit, razon_social, nombre_comercial,
 *   nombre_en_cxp, condicion_iva, cuenta_contable, cuenta_contable_nombre,
 *   cbu, alias, drive_carpeta_2026, servicio, direccion, telefono, email,
 *   en_tango, en_contaflow_2025, en_cxp_2026, observaciones
 *
 * - Si existe proveedor por CUIT: actualiza codigo_proveedor, alias_cbu, drive_carpeta,
 *   nombre_comercial, direccion, telefono, email, servicio
 * - Si no existe: lo inserta (solo si en_cxp_2026 = 'sí')
 */
import { openDB } from "./dbUtils.mjs";
import { parseCSV } from "./csvUtils.mjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function normCuit(c) {
  return (c || "").replace(/[-\s]/g, "");
}

const db = openDB();
const rows = parseCSV(path.join(ROOT, "docs/referencia/proveedores-maestro.csv"));

console.log(`=== IMPORTAR PROVEEDORES MAESTRO (${rows.length} filas) ===\n`);

// Cargar proveedores existentes por CUIT normalizado
const existing = await db.execute("SELECT id, cuit, codigo_proveedor FROM proveedores");
const byCuit = {};
for (const r of existing.rows) {
  byCuit[normCuit(r.cuit)] = r;
}

// Cargar plan_cuentas para resolver cuenta_contable por código Tango
const cuentas = await db.execute("SELECT id, codigo FROM plan_cuentas");
const cuentasByCodigo = {};
for (const c of cuentas.rows) {
  cuentasByCodigo[String(c.codigo)] = c.id;
}

let updated = 0, inserted = 0, skipped = 0;

for (const row of rows) {
  const cuitNorm = normCuit(row.cuit);
  if (!cuitNorm) { skipped++; continue; }

  const esCxp = (row.en_cxp_2026 || "").toLowerCase().trim() === "sí" ||
                (row.en_cxp_2026 || "").toLowerCase().trim() === "si";

  const campos = {
    codigo_proveedor: (row.codigo_proveedor || "").trim(),
    nombre_comercial: (row.nombre_comercial || "").trim(),
    alias_cbu: (row.alias || "").trim(),
    drive_carpeta: (row.drive_carpeta_2026 || "").trim(),
    servicio: (row.servicio || "").trim(),
    direccion: (row.direccion || "").trim(),
    telefono: (row.telefono || "").trim(),
    email: (row.email || "").trim(),
  };

  const prov = byCuit[cuitNorm];

  if (prov) {
    // Actualizar proveedor existente
    await db.execute(
      `UPDATE proveedores SET
         codigo_proveedor=?, nombre_comercial=?, alias_cbu=?, drive_carpeta=?,
         servicio=CASE WHEN ?<>'' THEN ? ELSE servicio END,
         direccion=CASE WHEN ?<>'' THEN ? ELSE direccion END,
         telefono=CASE WHEN ?<>'' THEN ? ELSE telefono END,
         email=CASE WHEN ?<>'' THEN ? ELSE email END
       WHERE id=?`,
      [
        campos.codigo_proveedor, campos.nombre_comercial, campos.alias_cbu, campos.drive_carpeta,
        campos.servicio, campos.servicio,
        campos.direccion, campos.direccion,
        campos.telefono, campos.telefono,
        campos.email, campos.email,
        prov.id,
      ]
    );
    updated++;
  } else if (esCxp) {
    // Insertar proveedor nuevo
    const cuentaId = cuentasByCodigo[String((row.cuenta_contable || "").trim())] || null;
    await db.execute(
      `INSERT INTO proveedores
         (cuit, razon_social, nombre_en_cxp, nombre_comercial, condicion_iva, cbu, alias_cbu,
          email, telefono, servicio, direccion, codigo_proveedor, drive_carpeta,
          cuenta_contable_id, activo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        row.cuit?.trim() || "",
        (row.razon_social || "").trim(),
        (row.nombre_en_cxp || "").trim(),
        campos.nombre_comercial,
        (row.condicion_iva || "").trim(),
        (row.cbu || "").trim(),
        campos.alias_cbu,
        campos.email,
        campos.telefono,
        campos.servicio,
        campos.direccion,
        campos.codigo_proveedor,
        campos.drive_carpeta,
        cuentaId,
      ]
    );
    inserted++;
  } else {
    skipped++;
  }
}

console.log(`Actualizados: ${updated}`);
console.log(`Insertados nuevos: ${inserted}`);
console.log(`Saltados (sin CUIT o no en CxP 2026): ${skipped}`);

// Verificar cuántos tienen código proveedor ahora
const conCodigo = await db.execute("SELECT COUNT(*) n FROM proveedores WHERE codigo_proveedor <> ''");
console.log(`\nProveedores con código: ${conCodigo.rows[0].n}`);

// Verificar cuántos tienen Drive link
const conDrive = await db.execute("SELECT COUNT(*) n FROM proveedores WHERE drive_carpeta <> ''");
console.log(`Proveedores con link Drive: ${conDrive.rows[0].n}`);

db.close();
console.log("\n✅ Maestro de proveedores importado.");
