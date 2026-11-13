/**
 * Migraciones para las correcciones post-carga 2025
 * - ordenes_pago: op_nro_tango, linea_extracto_id, a_revisar, revisar_motivo, pago_a_cuenta_2024
 * - retenciones_aplicadas: fecha, cuit_retenido, retenido, certificado_path, monto_comprobante
 * - facturas_recibidas / facturas_emitidas: estado_31_12_2025
 * - facturas_emitidas: nc_imputa_factura_id
 */
import { openDB, tryAlter } from "./dbUtils.mjs";
import { backupDB } from "./dbUtils.mjs";

backupDB("pre-correcciones-2025");
const db = openDB();

console.log("=== MIGRACIONES CORRECCIONES ===\n");

console.log("ordenes_pago:");
await tryAlter(db, "ordenes_pago", "op_nro_tango TEXT DEFAULT ''");
await tryAlter(db, "ordenes_pago", "linea_extracto_id INTEGER");
await tryAlter(db, "ordenes_pago", "a_revisar INTEGER DEFAULT 0");
await tryAlter(db, "ordenes_pago", "revisar_motivo TEXT DEFAULT ''");
await tryAlter(db, "ordenes_pago", "pago_a_cuenta_2024 INTEGER DEFAULT 0");
await tryAlter(db, "ordenes_pago", "diferencia REAL DEFAULT 0");
await tryAlter(db, "ordenes_pago", "comprobante_paths TEXT DEFAULT ''");
await tryAlter(db, "ordenes_pago", "cuit_proveedor TEXT DEFAULT ''");
await tryAlter(db, "ordenes_pago", "nombre_en_banco TEXT DEFAULT ''");
await tryAlter(db, "ordenes_pago", "origen TEXT DEFAULT 'manual'");

console.log("\nordenes_pago_items:");
await tryAlter(db, "ordenes_pago_items", "tipo TEXT DEFAULT 'factura'");
await tryAlter(db, "ordenes_pago_items", "descripcion TEXT DEFAULT ''");

console.log("\nretenciones_aplicadas:");
await tryAlter(db, "retenciones_aplicadas", "fecha TEXT DEFAULT ''");
await tryAlter(db, "retenciones_aplicadas", "cuit_retenido TEXT DEFAULT ''");
await tryAlter(db, "retenciones_aplicadas", "retenido TEXT DEFAULT ''");
await tryAlter(db, "retenciones_aplicadas", "certificado_path TEXT DEFAULT ''");
await tryAlter(db, "retenciones_aplicadas", "monto_comprobante REAL DEFAULT 0");
await tryAlter(db, "retenciones_aplicadas", "comprobante_origen TEXT DEFAULT ''");

console.log("\nfacturas_recibidas:");
await tryAlter(db, "facturas_recibidas", "estado_31_12_2025 TEXT DEFAULT ''");
await tryAlter(db, "facturas_recibidas", "nc_imputa_id INTEGER");
await tryAlter(db, "facturas_recibidas", "pdf_extra_paths TEXT DEFAULT ''");

console.log("\nfacturas_emitidas:");
await tryAlter(db, "facturas_emitidas", "estado_31_12_2025 TEXT DEFAULT ''");
await tryAlter(db, "facturas_emitidas", "nc_imputa_id INTEGER");
await tryAlter(db, "facturas_emitidas", "fecha_pago TEXT DEFAULT ''");

db.close();
console.log("\n✅ Migraciones completadas.");
