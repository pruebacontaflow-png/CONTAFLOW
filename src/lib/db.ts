import { createClient, type Client } from "@libsql/client";
import path from "path";

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (!client) {
    const dbPath = path.resolve(process.cwd(), "contaflow.db");
    const urlPath = dbPath.replace(/\\/g, "/");
    const url = urlPath.startsWith("/") ? `file:${urlPath}` : `file:/${urlPath}`;
    client = createClient({ url });
  }
  return client;
}

function rowToObject(row: any, columns: string[]): Record<string, any> {
  const obj: Record<string, any> = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

export const db = {
  async get(sql: string, args: any[] = []): Promise<Record<string, any> | null> {
    await ensureInit();
    const result = await getClient().execute({ sql, args });
    if (!result.rows.length) return null;
    return rowToObject(result.rows[0], result.columns);
  },

  async all(sql: string, args: any[] = []): Promise<Record<string, any>[]> {
    await ensureInit();
    const result = await getClient().execute({ sql, args });
    return result.rows.map(row => rowToObject(row, result.columns));
  },

  async run(sql: string, args: any[] = []): Promise<{ lastInsertRowid: bigint | undefined; rowsAffected: number }> {
    await ensureInit();
    const result = await getClient().execute({ sql, args });
    return { lastInsertRowid: result.lastInsertRowid, rowsAffected: result.rowsAffected };
  },

  async exec(sql: string): Promise<void> {
    await ensureInit();
    const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      await getClient().execute(stmt);
    }
  },
};

async function ensureInit() {
  if (initialized) return;
  initialized = true;
  await initializeSchema();
}

async function tryAlter(sql: string) {
  try { await getClient().execute(sql); } catch {}
}

async function initializeSchema() {
  const c = getClient();

  // WAL mode y timeout para concurrencia segura
  await c.execute("PRAGMA journal_mode=WAL");
  await c.execute("PRAGMA busy_timeout=5000");
  await c.execute("PRAGMA foreign_keys=ON");

  const tables = [
    `CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      cuit TEXT NOT NULL UNIQUE,
      categoria TEXT DEFAULT '',
      email TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      condicion_iva TEXT DEFAULT 'Responsable Inscripto',
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razon_social TEXT NOT NULL,
      cuit TEXT NOT NULL UNIQUE,
      categoria TEXT DEFAULT '',
      email TEXT DEFAULT '',
      condicion_iva TEXT DEFAULT 'Responsable Inscripto',
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS facturas_recibidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proveedor_id INTEGER NOT NULL,
      tipo_comprobante TEXT NOT NULL,
      numero TEXT NOT NULL,
      fecha_emision TEXT NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      importe_neto REAL NOT NULL DEFAULT 0,
      tipo_iva TEXT NOT NULL DEFAULT '21%',
      importe_iva REAL NOT NULL DEFAULT 0,
      importe_total REAL NOT NULL DEFAULT 0,
      concepto TEXT DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'pendiente_pago',
      pdf_path TEXT DEFAULT '',
      comentario_admin TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS facturas_emitidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo_comprobante TEXT NOT NULL,
      numero TEXT NOT NULL,
      fecha_emision TEXT NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      importe_neto REAL NOT NULL DEFAULT 0,
      tipo_iva TEXT NOT NULL DEFAULT '21%',
      importe_iva REAL NOT NULL DEFAULT 0,
      importe_total REAL NOT NULL DEFAULT 0,
      concepto TEXT DEFAULT '',
      estado TEXT NOT NULL DEFAULT 'cobro_pendiente',
      pdf_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS cuentas_bancarias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      banco TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Cuenta Corriente',
      moneda TEXT NOT NULL DEFAULT 'ARS',
      saldo_actual REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS movimientos_bancarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cuenta_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      saldo_anterior REAL NOT NULL DEFAULT 0,
      saldo_nuevo REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      descripcion TEXT DEFAULT '',
      tipo TEXT NOT NULL,
      importe REAL NOT NULL DEFAULT 0,
      cuenta_id INTEGER,
      categoria TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS vencimientos_fiscales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descripcion TEXT NOT NULL,
      fecha_vencimiento TEXT NOT NULL,
      importe REAL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'proveedor',
      proveedor_id INTEGER,
      activo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];

  for (const sql of tables) {
    await c.execute(sql);
  }

  // Migraciones: agregar columnas nuevas a tablas existentes sin romper datos
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN comentario_admin TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN cargada_por_proveedor INTEGER DEFAULT 0`);

  // Fase 1 — campos para ingesta automática (n8n / portal)
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN punto_venta TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN neto_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN neto_no_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN exento REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN percepcion_iva REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN percepcion_iibb REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN percepcion_otras REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN moneda TEXT DEFAULT 'ARS'`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN tipo_cambio REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN cuit_emisor TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN vencimiento_cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN hash_pdf TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN confianza_extraccion REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN origen TEXT DEFAULT 'manual'`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN motivo_revision TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN drive_file_id TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN drive_url TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN drive_carpeta TEXT DEFAULT ''`);

  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN punto_venta TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN neto_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN neto_no_gravado REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN exento REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN percepcion_iva REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN percepcion_iibb REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN percepcion_otras REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN moneda TEXT DEFAULT 'ARS'`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN tipo_cambio REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN cuit_receptor TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN vencimiento_cae TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN hash_pdf TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN confianza_extraccion REAL DEFAULT 1`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN origen TEXT DEFAULT 'manual'`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN motivo_revision TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN drive_file_id TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN drive_url TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN drive_carpeta TEXT DEFAULT ''`);

  // Fase 2 — datos de pago visibles en el portal proveedor
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN fecha_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN numero_op TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN comprobante_pago_path TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN certificado_retencion_path TEXT DEFAULT ''`);

  // Fase 3 — órdenes de pago, retenciones, cuentas corrientes
  await c.execute(`CREATE TABLE IF NOT EXISTS retenciones_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT NOT NULL DEFAULT 'ganancias_sicore',
    descripcion TEXT NOT NULL,
    codigo_regimen TEXT DEFAULT '',
    alicuota REAL NOT NULL DEFAULT 0,
    minimo_no_imponible REAL DEFAULT 0,
    acumula_mensual INTEGER DEFAULT 1,
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS ordenes_pago (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    numero TEXT NOT NULL,
    importe_bruto REAL NOT NULL DEFAULT 0,
    total_retenciones REAL NOT NULL DEFAULT 0,
    importe_neto REAL NOT NULL DEFAULT 0,
    cuenta_bancaria_id INTEGER,
    estado TEXT NOT NULL DEFAULT 'borrador',
    observaciones TEXT DEFAULT '',
    comprobante_path TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS ordenes_pago_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_pago_id INTEGER NOT NULL,
    factura_id INTEGER NOT NULL,
    importe REAL NOT NULL DEFAULT 0
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS retenciones_aplicadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orden_pago_id INTEGER NOT NULL,
    config_id INTEGER,
    tipo TEXT NOT NULL DEFAULT '',
    descripcion TEXT NOT NULL DEFAULT '',
    codigo_regimen TEXT DEFAULT '',
    base_calculo REAL NOT NULL DEFAULT 0,
    alicuota REAL NOT NULL DEFAULT 0,
    importe REAL NOT NULL DEFAULT 0,
    certificado_numero TEXT DEFAULT ''
  )`);

  // Fase 4 — contabilidad: plan de cuentas, asientos, períodos, detalle IVA
  await c.execute(`CREATE TABLE IF NOT EXISTS plan_cuentas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'egreso',
    subtipo TEXT DEFAULT '',
    parent_id INTEGER,
    imputable INTEGER DEFAULT 1,
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS periodos_contables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    cerrado INTEGER DEFAULT 0,
    fecha_cierre TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(anio, mes)
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS asientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'manual',
    referencia_id INTEGER,
    referencia_tipo TEXT DEFAULT '',
    anio INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    estado TEXT NOT NULL DEFAULT 'confirmado',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS asientos_lineas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asiento_id INTEGER NOT NULL,
    cuenta_id INTEGER NOT NULL,
    descripcion TEXT DEFAULT '',
    debe REAL NOT NULL DEFAULT 0,
    haber REAL NOT NULL DEFAULT 0
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS facturas_iva_detalle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    factura_id INTEGER NOT NULL,
    tabla TEXT NOT NULL DEFAULT 'recibidas',
    alicuota TEXT NOT NULL,
    base_imponible REAL NOT NULL DEFAULT 0,
    importe REAL NOT NULL DEFAULT 0
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS parametros (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT DEFAULT ''
  )`);

  // Seed plan de cuentas (solo si vacío)
  const countPC = await c.execute(`SELECT COUNT(*) as n FROM plan_cuentas`);
  if (Number(countPC.rows[0]?.[0] ?? 0) === 0) {
    const cuentas = [
      // tipo, codigo, nombre, imputable, parent_codigo
      ["activo",     "1",       "Activo",                           0, null],
      ["activo",     "1.1",     "Activo Corriente",                 0, "1"],
      ["activo",     "1.1.01",  "Caja",                             1, "1.1"],
      ["activo",     "1.1.02",  "Banco cuenta corriente",           1, "1.1"],
      ["activo",     "1.1.03",  "Créditos por ventas",              1, "1.1"],
      ["activo",     "1.1.04",  "IVA Crédito Fiscal",               1, "1.1"],
      ["activo",     "1.1.05",  "Anticipos a proveedores",          1, "1.1"],
      ["activo",     "1.2",     "Activo No Corriente",              0, "1"],
      ["activo",     "1.2.01",  "Bienes de Uso",                    1, "1.2"],
      ["pasivo",     "2",       "Pasivo",                           0, null],
      ["pasivo",     "2.1",     "Pasivo Corriente",                 0, "2"],
      ["pasivo",     "2.1.01",  "Proveedores",                      1, "2.1"],
      ["pasivo",     "2.1.02",  "IVA Débito Fiscal",                1, "2.1"],
      ["pasivo",     "2.1.03",  "Retenciones a depositar",          1, "2.1"],
      ["pasivo",     "2.1.04",  "Sueldos a pagar",                  1, "2.1"],
      ["pasivo",     "2.1.05",  "Cargas sociales a pagar",          1, "2.1"],
      ["patrimonio", "3",       "Patrimonio Neto",                  0, null],
      ["patrimonio", "3.1.01",  "Capital social",                   1, "3"],
      ["patrimonio", "3.1.02",  "Resultados no asignados",          1, "3"],
      ["ingreso",    "4",       "Ingresos",                         0, null],
      ["ingreso",    "4.1",     "Ingresos por ventas",              0, "4"],
      ["ingreso",    "4.1.01",  "Ventas de servicios",              1, "4.1"],
      ["ingreso",    "4.1.02",  "Ventas de bienes",                 1, "4.1"],
      ["egreso",     "5",       "Egresos",                          0, null],
      ["egreso",     "5.1",     "Gastos operativos",                0, "5"],
      ["egreso",     "5.1.01",  "Gastos generales",                 1, "5.1"],
      ["egreso",     "5.1.02",  "Servicios (luz, gas, telefonía)",  1, "5.1"],
      ["egreso",     "5.1.03",  "Honorarios",                       1, "5.1"],
      ["egreso",     "5.1.04",  "Sueldos y cargas sociales",        1, "5.1"],
      ["egreso",     "5.1.05",  "Alquileres",                       1, "5.1"],
      ["egreso",     "5.2",     "Gastos financieros",               0, "5"],
      ["egreso",     "5.2.01",  "Gastos bancarios",                 1, "5.2"],
      ["egreso",     "5.2.02",  "Intereses",                        1, "5.2"],
    ];
    // First pass: insert without parent_id
    for (const [tipo, codigo, nombre, imputable] of cuentas) {
      await c.execute({
        sql: `INSERT OR IGNORE INTO plan_cuentas (tipo,codigo,nombre,imputable) VALUES (?,?,?,?)`,
        args: [tipo, codigo, nombre, imputable],
      });
    }
    // Second pass: set parent_id
    for (const [, codigo, , , parentCodigo] of cuentas) {
      if (parentCodigo) {
        await c.execute({
          sql: `UPDATE plan_cuentas SET parent_id=(SELECT id FROM plan_cuentas WHERE codigo=?) WHERE codigo=?`,
          args: [parentCodigo, codigo],
        });
      }
    }
  }

  // Seed parametros (solo si vacío)
  const countP = await c.execute(`SELECT COUNT(*) as n FROM parametros`);
  if (Number(countP.rows[0]?.[0] ?? 0) === 0) {
    const params = [
      ["cuenta_gastos_default",    "5.1.01", "Código de cuenta para gastos generales"],
      ["cuenta_iva_credito",       "1.1.04", "Código de cuenta IVA Crédito Fiscal"],
      ["cuenta_proveedores",       "2.1.01", "Código de cuenta Proveedores"],
      ["cuenta_banco_default",     "1.1.02", "Código de cuenta banco por defecto"],
      ["cuenta_retenciones_pagar", "2.1.03", "Código de cuenta Retenciones a depositar"],
      ["cuenta_iva_debito",        "2.1.02", "Código de cuenta IVA Débito Fiscal"],
      ["cuenta_ventas_default",    "4.1.01", "Código de cuenta ventas por defecto"],
      ["cuenta_creditos_clientes", "1.1.03", "Código de cuenta Créditos por ventas"],
    ];
    for (const [clave, valor, descripcion] of params) {
      await c.execute({
        sql: `INSERT OR IGNORE INTO parametros (clave,valor,descripcion) VALUES (?,?,?)`,
        args: [clave, valor, descripcion],
      });
    }
  }

  // Agregar parámetro nuevo si no existe (para DBs existentes)
  await c.execute(`INSERT OR IGNORE INTO parametros (clave,valor,descripcion) VALUES ('cuenta_creditos_clientes','1.1.03','Código de cuenta Créditos por ventas')`);


  // Fase 5 — extractos bancarios, conciliación, reglas clasificación
  await tryAlter(`ALTER TABLE periodos_contables ADD COLUMN cerrado_por TEXT DEFAULT ''`);

  await c.execute(`CREATE TABLE IF NOT EXISTS extractos_bancarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_bancaria_id INTEGER NOT NULL,
    fecha_desde TEXT NOT NULL,
    fecha_hasta TEXT NOT NULL,
    saldo_inicial REAL NOT NULL DEFAULT 0,
    saldo_final REAL NOT NULL DEFAULT 0,
    total_debitos REAL NOT NULL DEFAULT 0,
    total_creditos REAL NOT NULL DEFAULT 0,
    cantidad_lineas INTEGER DEFAULT 0,
    nombre_archivo TEXT DEFAULT '',
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS extractos_lineas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    extracto_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    referencia TEXT DEFAULT '',
    debito REAL DEFAULT 0,
    credito REAL DEFAULT 0,
    saldo REAL DEFAULT 0,
    categoria TEXT DEFAULT '',
    cuenta_contable_id INTEGER,
    conciliado INTEGER DEFAULT 0,
    referencia_tipo TEXT DEFAULT '',
    referencia_id INTEGER,
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS reglas_clasificacion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    patron TEXT NOT NULL,
    tipo_match TEXT DEFAULT 'contiene',
    categoria TEXT DEFAULT '',
    cuenta_contable_id INTEGER,
    descripcion_reemplazo TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    prioridad INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // Bloque A — columnas adicionales y tabla de auditoría
  await tryAlter(`ALTER TABLE extractos_bancarios ADD COLUMN hash_archivo TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE cuentas_bancarias ADD COLUMN config_columnas TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE ordenes_pago ADD COLUMN concepto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE ordenes_pago ADD COLUMN es_anticipo INTEGER DEFAULT 0`);

  await c.execute(`CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL,
    fecha TEXT DEFAULT (datetime('now')),
    accion TEXT NOT NULL,
    entidad_tipo TEXT NOT NULL,
    entidad_id INTEGER,
    valor_anterior TEXT DEFAULT '',
    valor_nuevo TEXT DEFAULT '',
    ip TEXT DEFAULT ''
  )`);

  // Bloque B — desactivar usuarios con rol proveedor (portal eliminado)
  await c.execute(`UPDATE usuarios SET activo=0 WHERE rol='proveedor'`);

  // Bloque C — historial de sincronización con Google Drive
  await c.execute(`CREATE TABLE IF NOT EXISTS drive_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT DEFAULT (datetime('now')),
    carpeta_id TEXT DEFAULT '',
    carpeta_nombre TEXT DEFAULT '',
    archivos_encontrados INTEGER DEFAULT 0,
    archivos_procesados INTEGER DEFAULT 0,
    archivos_duplicados INTEGER DEFAULT 0,
    archivos_error INTEGER DEFAULT 0,
    duracion_ms INTEGER DEFAULT 0,
    estado TEXT DEFAULT 'ok',
    detalle TEXT DEFAULT '',
    iniciado_por TEXT DEFAULT 'sistema'
  )`);

  // Bloque C — tabla de ingesta pendiente (procesada por el script standalone)
  await c.execute(`CREATE TABLE IF NOT EXISTS ingesta_pendiente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drive_file_id TEXT UNIQUE,
    drive_carpeta TEXT DEFAULT '',
    archivo_nombre TEXT DEFAULT '',
    datos_json TEXT DEFAULT '{}',
    estado TEXT DEFAULT 'pendiente',
    creado_en TEXT DEFAULT (datetime('now'))
  )`);

  // ── BLOQUE A ──────────────────────────────────────────────────────────────

  // A1 — nc_imputa_id ya existe; negamos NCs en facturas_recibidas y emitidas
  await tryAlter(`ALTER TABLE facturas_recibidas ADD COLUMN nc_imputa_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE facturas_emitidas ADD COLUMN nc_imputa_id INTEGER DEFAULT NULL`);
  // Marcar NCs como negativas si aún son positivas
  await c.execute(`UPDATE facturas_recibidas SET importe_neto = -ABS(importe_neto), importe_iva = -ABS(importe_iva), importe_total = -ABS(importe_total) WHERE tipo_comprobante LIKE 'Nota de Cr%' AND importe_total > 0`);
  await c.execute(`UPDATE facturas_emitidas SET importe_neto = -ABS(importe_neto), importe_iva = -ABS(importe_iva), importe_total = -ABS(importe_total) WHERE tipo_comprobante LIKE 'Nota de Cr%' AND importe_total > 0`);

  // A3 — proveedor_drive_carpetas (carpeta Drive por proveedor y año)
  await c.execute(`CREATE TABLE IF NOT EXISTS proveedor_drive_carpetas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proveedor_id INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    link TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(proveedor_id, anio)
  )`);
  // Columnas adicionales en proveedores
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN banco TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN categoria_arca TEXT DEFAULT ''`);

  // A4 — tabla comerciales
  await c.execute(`CREATE TABLE IF NOT EXISTS comerciales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    proveedor_id INTEGER,
    zona TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // A6 — inversiones
  await c.execute(`CREATE TABLE IF NOT EXISTS inversiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'plazo_fijo',
    entidad TEXT DEFAULT '',
    moneda TEXT DEFAULT 'ARS',
    saldo_actual REAL DEFAULT 0,
    tasa_nominal REAL DEFAULT 0,
    fecha_inicio TEXT DEFAULT '',
    fecha_vencimiento TEXT DEFAULT '',
    estado TEXT DEFAULT 'activa',
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS inversion_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inversion_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'deposito',
    importe REAL NOT NULL DEFAULT 0,
    descripcion TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // A7 — productos y stock
  await c.execute(`CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE,
    nombre TEXT NOT NULL,
    unidad TEXT DEFAULT 'unidad',
    stock_actual REAL DEFAULT 0,
    stock_minimo REAL DEFAULT 0,
    observaciones TEXT DEFAULT '',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS stock_movimientos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'egreso',
    cantidad REAL NOT NULL DEFAULT 0,
    stock_resultante REAL DEFAULT 0,
    destino TEXT DEFAULT '',
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // A8 — fondo fijo multicaja
  await c.execute(`CREATE TABLE IF NOT EXISTS fondo_fijo_cajas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    moneda TEXT NOT NULL DEFAULT 'ARS',
    responsable TEXT DEFAULT '',
    saldo_actual REAL DEFAULT 0,
    activa INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN caja_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN proyecto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN area TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN moneda TEXT DEFAULT 'ARS'`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN comprobante_numero TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN es_reposicion INTEGER DEFAULT 0`);
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN op_id INTEGER DEFAULT NULL`);

  // ── BLOQUE B ──────────────────────────────────────────────────────────────

  // B15 — chequeras (SAP-style checkbook management)
  await c.execute(`CREATE TABLE IF NOT EXISTS chequeras (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL DEFAULT '',
    banco TEXT NOT NULL DEFAULT '',
    id_cuenta TEXT NOT NULL DEFAULT '',
    sociedad TEXT NOT NULL DEFAULT 'IT Click Video',
    activo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS chequera_intervalos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chequera_id INTEGER NOT NULL,
    numero_remesa INTEGER NOT NULL DEFAULT 1,
    numero_desde TEXT NOT NULL DEFAULT '',
    numero_hasta TEXT NOT NULL DEFAULT '',
    info_breve TEXT DEFAULT '',
    fecha_compra TEXT DEFAULT '',
    no_secuencial INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  await c.execute(`CREATE TABLE IF NOT EXISTS cheques_emitidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chequera_id INTEGER NOT NULL,
    intervalo_id INTEGER,
    numero TEXT NOT NULL,
    fecha_emision TEXT NOT NULL,
    fecha_vencimiento TEXT DEFAULT '',
    beneficiario TEXT DEFAULT '',
    importe REAL NOT NULL DEFAULT 0,
    moneda TEXT DEFAULT 'ARS',
    estado TEXT DEFAULT 'en_cartera',
    op_id INTEGER,
    observaciones TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // B20 — flag prioritario en lotes_pago
  await tryAlter(`ALTER TABLE lotes_pago ADD COLUMN prioritario INTEGER DEFAULT 0`);

  // ── BLOQUE C ──────────────────────────────────────────────────────────────

  // C.1 — columnas adicionales en acuerdos_comerciales para datos de los docs
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN nro_oc TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN campania TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN precio_texto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN modalidad TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN forma_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN plazo_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN contacto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN archivo_word TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN importe_canje REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN cliente_original TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE acuerdos_comerciales ADD COLUMN comercial_id INTEGER DEFAULT NULL`);

  // C.2 — columnas adicionales en comisiones y tabla de tramos
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN factura_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN coincide_factura INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN pct_cumplimiento REAL DEFAULT NULL`);
  await tryAlter(`ALTER TABLE comisiones ADD COLUMN pct_comision REAL DEFAULT NULL`);
  await c.execute(`CREATE TABLE IF NOT EXISTS comisiones_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    descripcion TEXT NOT NULL DEFAULT '',
    pct_comision REAL NOT NULL DEFAULT 0.10,
    reparto_igual INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS comisiones_tramos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pct_cumplimiento_min REAL NOT NULL,
    pct_cumplimiento_max REAL NOT NULL,
    pct_aplicar REAL NOT NULL,
    notas TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await c.execute(`CREATE TABLE IF NOT EXISTS presupuesto_comercial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER,
    cliente_nombre TEXT DEFAULT '',
    periodo TEXT NOT NULL,
    ingresos_proyectados REAL DEFAULT 0,
    ingresos_reales REAL DEFAULT 0,
    gastos_comerciales REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  // C.3 — tipo retiro_prestamo en fondo_fijo (ya existe la tabla, solo verificar)
  await tryAlter(`ALTER TABLE fondo_fijo_movimientos ADD COLUMN es_retiro_prestamo INTEGER DEFAULT 0`);

  // C.5 — columnas adicionales en viaticos para rendiciones
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN archivo_adjunto TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN año INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN mes INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN medio_pago TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN caja_mov_id INTEGER DEFAULT NULL`);
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN extracto_linea_id INTEGER DEFAULT NULL`);

  // B.11 — OP ligada a la rendición (OPE para efectivo, OP normal para transferencia)
  await tryAlter(`ALTER TABLE viaticos ADD COLUMN op_rendicion_id INTEGER DEFAULT NULL`);

  // B.9 — Lote de pagos: fecha de pago separada de fecha de creación; OP por ítem al ejecutar
  await tryAlter(`ALTER TABLE lotes_pago ADD COLUMN fecha_pago TEXT DEFAULT NULL`);
  await tryAlter(`ALTER TABLE lotes_pago_items ADD COLUMN op_id INTEGER DEFAULT NULL`);

  // Impuestos: columnas adicionales de DDJJ (PDF, organismo, saldo a favor)
  await tryAlter(`ALTER TABLE declaraciones_juradas ADD COLUMN archivo_path TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE declaraciones_juradas ADD COLUMN organismo TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE declaraciones_juradas ADD COLUMN fecha_presentacion TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE declaraciones_juradas ADD COLUMN fecha_vencimiento TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE declaraciones_juradas ADD COLUMN saldo_a_favor REAL DEFAULT NULL`);
  await tryAlter(`ALTER TABLE declaraciones_juradas ADD COLUMN origen TEXT DEFAULT ''`);

  // Diferencias a conciliar contra ARCA (CxP / CxC vs Mis Comprobantes)
  await c.execute(`CREATE TABLE IF NOT EXISTS diferencias_arca (
    id INTEGER PRIMARY KEY AUTOINCREMENT, libro TEXT, tipo_diferencia TEXT, fecha TEXT, cuit TEXT, contraparte TEXT,
    comprobante TEXT, valor_sistema TEXT, valor_arca TEXT, importe_sistema REAL, importe_arca REAL, diferencia REAL,
    factura_id INTEGER, detalle TEXT, estado TEXT DEFAULT 'pendiente', resolucion TEXT, resuelto_por TEXT, resuelto_at TEXT,
    periodo TEXT DEFAULT '2025'
  )`);

  // BLOQUE A etapa 6 — cuentas no operativas del flujo de caja (configurables)
  await c.execute(`CREATE TABLE IF NOT EXISTS cuentas_excluidas_dashboard (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cuenta_tango TEXT NOT NULL UNIQUE,
    descripcion TEXT DEFAULT '',
    activa INTEGER DEFAULT 1
  )`);
  await c.execute(`INSERT OR IGNORE INTO cuentas_excluidas_dashboard (cuenta_tango, descripcion) VALUES ('11475', 'Préstamos')`);
  await c.execute(`INSERT OR IGNORE INTO cuentas_excluidas_dashboard (cuenta_tango, descripcion) VALUES ('11485', 'Cuenta particular LJ')`);
  await c.execute(`INSERT OR IGNORE INTO cuentas_excluidas_dashboard (cuenta_tango, descripcion) VALUES ('11404', 'Anticipos LJ')`);

  // Datos iniciales de retenciones_config (solo si la tabla está vacía)
  const countRet = await c.execute(`SELECT COUNT(*) as n FROM retenciones_config`);
  const n = countRet.rows[0]?.[0];
  if (!n || Number(n) === 0) {
    const semilla = [
      ["ganancias_sicore", "Ganancias - Servicios (RG 830)",           "067", 0.06,   0,       1],
      ["ganancias_sicore", "Ganancias - Locaciones y prestaciones (RG 830)", "217", 0.03, 0, 1],
      ["ganancias_sicore", "Ganancias - Compras (RG 830)",             "001", 0.03,   0,       1],
      ["iibb_agip",        "IIBB AGIP - Ciudad de Buenos Aires",       "",    0.025,  0,       0],
      ["iibb_arba",        "IIBB ARBA - Provincia de Buenos Aires",    "",    0.015,  0,       0],
    ];
    for (const [tipo, desc, cod, alic, mni, acum] of semilla) {
      await c.execute({
        sql: `INSERT INTO retenciones_config (tipo,descripcion,codigo_regimen,alicuota,minimo_no_imponible,acumula_mensual) VALUES (?,?,?,?,?,?)`,
        args: [tipo, desc, cod, alic, mni, acum],
      });
    }
  }

  // Punto 0 (etapa 6b) — Solo somos agentes de Ganancias RG 830, no de IIBB (confirmado contadora 22-11-2026)
  await c.execute(`UPDATE retenciones_config SET activo=0 WHERE tipo IN ('iibb_agip','iibb_arba')`);
  await c.execute(`UPDATE retenciones_config SET activo=0 WHERE codigo_regimen IN ('067','217','001') AND tipo='ganancias_sicore'`);
  // Régimen real: 094 Locaciones de obra y/o servicios, 2%, MNI $67.170 acumulado por proveedor y mes
  await c.execute(`INSERT OR IGNORE INTO retenciones_config
    (id,tipo,descripcion,codigo_regimen,alicuota,minimo_no_imponible,acumula_mensual,activo)
    VALUES (6,'ganancias_sicore','Ganancias - Locaciones de obra y/o servicios (RG 830 reg. 094)','094',0.02,67170,1,1)`);

  // Punto 0.5 — campos impositivos en proveedores y certificado de exclusión de Ganancias
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN condicion_ganancias TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN nro_iibb TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN jurisdiccion_iibb TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exento_ganancias INTEGER DEFAULT 0`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exento_iibb INTEGER DEFAULT 0`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exclusion_ganancias_cert TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exclusion_ganancias_pct REAL DEFAULT 0`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exclusion_ganancias_desde TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exclusion_ganancias_hasta TEXT DEFAULT ''`);
  await tryAlter(`ALTER TABLE proveedores ADD COLUMN exclusion_ganancias_pdf TEXT DEFAULT ''`);
}

export default db;
