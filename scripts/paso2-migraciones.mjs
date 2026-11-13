/**
 * Paso 2: Agregar columnas nuevas para datos reales 2025
 * Idempotente - usa ALTER TABLE ... ADD COLUMN (falla si ya existe, se ignora)
 */
import { openDB, tryAlter } from "./dbUtils.mjs";

const db = openDB();
console.log("=== MIGRACIONES PARA DATOS REALES 2025 ===\n");

// plan_cuentas
console.log("plan_cuentas:");
await tryAlter(db, "plan_cuentas", "clase TEXT DEFAULT ''");
await tryAlter(db, "plan_cuentas", "saldo_habitual TEXT DEFAULT ''");
await tryAlter(db, "plan_cuentas", "habilitado INTEGER DEFAULT 1");
await tryAlter(db, "plan_cuentas", "ajuste_inflacion INTEGER DEFAULT 0");
await tryAlter(db, "plan_cuentas", "afecta_conversion INTEGER DEFAULT 0");
await tryAlter(db, "plan_cuentas", "resultado_tenencia INTEGER DEFAULT 0");
await tryAlter(db, "plan_cuentas", "unidad_adicional INTEGER DEFAULT 0");
await tryAlter(db, "plan_cuentas", "es_axi INTEGER DEFAULT 0");

// proveedores
console.log("\nproveedores:");
await tryAlter(db, "proveedores", "nombre_en_cxp TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "cbu TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "servicio TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "cuenta_contable_id INTEGER");
await tryAlter(db, "proveedores", "direccion TEXT DEFAULT ''");
await tryAlter(db, "proveedores", "contacto TEXT DEFAULT ''");

// clientes (solo estadísticas anuales — no se guardan en tabla, se calculan dinámico)

// facturas_recibidas
console.log("\nfacturas_recibidas:");
await tryAlter(db, "facturas_recibidas", "iva_otras REAL DEFAULT 0");
await tryAlter(db, "facturas_recibidas", "importe_sin_iva_discriminado REAL DEFAULT 0");
await tryAlter(db, "facturas_recibidas", "periodo TEXT DEFAULT ''");
await tryAlter(db, "facturas_recibidas", "proyecto TEXT DEFAULT ''");
await tryAlter(db, "facturas_recibidas", "centro_costo TEXT DEFAULT ''");
await tryAlter(db, "facturas_recibidas", "area TEXT DEFAULT ''");
await tryAlter(db, "facturas_recibidas", "linea_negocio TEXT DEFAULT ''");
await tryAlter(db, "facturas_recibidas", "estado_pago TEXT DEFAULT ''");

// facturas_emitidas
console.log("\nfacturas_emitidas:");
await tryAlter(db, "facturas_emitidas", "otros_tributos REAL DEFAULT 0");
await tryAlter(db, "facturas_emitidas", "periodo TEXT DEFAULT ''");
await tryAlter(db, "facturas_emitidas", "proyecto TEXT DEFAULT ''");
await tryAlter(db, "facturas_emitidas", "linea_negocio TEXT DEFAULT ''");
await tryAlter(db, "facturas_emitidas", "estado_cobro TEXT DEFAULT ''");
await tryAlter(db, "facturas_emitidas", "fecha_cobro TEXT DEFAULT ''");

// extractos_lineas
console.log("\nextractos_lineas:");
await tryAlter(db, "extractos_lineas", "nro_comprobante TEXT DEFAULT ''");
await tryAlter(db, "extractos_lineas", "codigo_banco TEXT DEFAULT ''");
await tryAlter(db, "extractos_lineas", "comentario TEXT DEFAULT ''");
await tryAlter(db, "extractos_lineas", "linea_negocio TEXT DEFAULT ''");
await tryAlter(db, "extractos_lineas", "cuenta_tango TEXT DEFAULT ''");
await tryAlter(db, "extractos_lineas", "comentario_ro TEXT DEFAULT ''");
await tryAlter(db, "extractos_lineas", "tiene_dos_cuentas INTEGER DEFAULT 0");

// cuentas_bancarias
console.log("\ncuentas_bancarias:");
await tryAlter(db, "cuentas_bancarias", "cuenta_contable_id INTEGER");
await tryAlter(db, "cuentas_bancarias", "numero_cuenta TEXT DEFAULT ''");

// extractos_bancarios (cabecera)
console.log("\nextractos_bancarios:");
await tryAlter(db, "extractos_bancarios", "origen TEXT DEFAULT 'historico_2025'");

// extractos_lineas (adicional)
await tryAlter(db, "extractos_lineas", "origen TEXT DEFAULT 'historico_2025'");

db.close();
console.log("\n✅ Migraciones completadas.");
