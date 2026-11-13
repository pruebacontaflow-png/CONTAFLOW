// init-db.js — Inicializador de base de datos ContaFlow
// Usa @libsql/client (instalado con npm install)
import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'contaflow.db');
const client = createClient({ url: `file:${dbPath}` });

console.log('🏗️  Creando tablas en contaflow.db...');

async function run() {
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
  ];

  for (const sql of tables) {
    await client.execute(sql);
  }
  console.log('✅ Tablas creadas');

  // Limpiar datos existentes
  for (const t of ['facturas_recibidas','facturas_emitidas','movimientos','movimientos_bancarios','vencimientos_fiscales','proveedores','clientes','cuentas_bancarias']) {
    await client.execute(`DELETE FROM ${t}`);
  }

  // Proveedores de ejemplo
  console.log('📦 Insertando proveedores...');
  const proveedores = [
    ['Servicios TI SA', '30-71234567-8', 'Tecnología', 'facturacion@servicios-ti.com.ar', '011-4523-8900', 'Responsable Inscripto'],
    ['Papelería del Norte SRL', '30-68901234-5', 'Insumos', 'ventas@papelanorte.com.ar', '011-4412-7700', 'Responsable Inscripto'],
    ['Transportes Rapido Ltda', '30-65432109-7', 'Logística', 'admin@transrapido.com.ar', '011-4788-2200', 'Responsable Inscripto'],
    ['Consulting Group SA', '30-72345678-9', 'Consultoría', 'info@consultgroup.com.ar', '011-4900-1100', 'Responsable Inscripto'],
    ['Seguros del Sur SA', '30-55667788-3', 'Seguros', 'polizas@segurosdelsur.com.ar', '0800-333-5566', 'Responsable Inscripto'],
    ['Electricidad Total SRL', '30-61234567-0', 'Servicios', 'facturacion@electotal.com.ar', '011-4556-3300', 'Monotributista'],
    ['Marketing Digital SA', '30-73456789-1', 'Marketing', 'cuentas@mktdigital.com.ar', '011-4299-5500', 'Responsable Inscripto'],
  ];

  const provIds = [];
  for (const p of proveedores) {
    const r = await client.execute({ sql: `INSERT INTO proveedores (razon_social, cuit, categoria, email, telefono, condicion_iva) VALUES (?, ?, ?, ?, ?, ?)`, args: p });
    provIds.push(r.lastInsertRowid);
  }
  console.log(`  → ${proveedores.length} proveedores`);

  // Clientes
  console.log('👥 Insertando clientes...');
  const clientes = [
    ['Manufactura La Pampa SA', '30-80123456-7', 'Industria', 'cuentasapagar@lapampa.com.ar', 'Responsable Inscripto'],
    ['Comercial Sur SRL', '30-78901234-5', 'Comercio', 'admin@comersialsur.com.ar', 'Responsable Inscripto'],
    ['Distribuidora ABC SA', '30-81234567-8', 'Distribución', 'pagos@distribabc.com.ar', 'Responsable Inscripto'],
    ['Retail Soluciones SRL', '30-79012345-6', 'Retail', 'finanzas@retailsoluciones.com.ar', 'Responsable Inscripto'],
    ['Gastronómica Del Oeste SA', '30-82345678-9', 'Gastronomía', 'admin@gastrooeste.com.ar', 'Responsable Inscripto'],
  ];

  const cliIds = [];
  for (const c of clientes) {
    const r = await client.execute({ sql: `INSERT INTO clientes (razon_social, cuit, categoria, email, condicion_iva) VALUES (?, ?, ?, ?, ?)`, args: c });
    cliIds.push(r.lastInsertRowid);
  }
  console.log(`  → ${clientes.length} clientes`);

  // Fechas relativas
  const addDias = (d) => {
    const f = new Date();
    f.setDate(f.getDate() + d);
    return f.toISOString().split('T')[0];
  };

  // Facturas recibidas
  console.log('📄 Insertando facturas recibidas...');
  const facturasRec = [
    [provIds[0], 'A', '0001-00001234', addDias(-45), addDias(-15), 150000, '21%', 31500, 181500, 'Servicio mensual de soporte técnico', 'pagada'],
    [provIds[0], 'A', '0001-00001289', addDias(-15), addDias(15), 180000, '21%', 37800, 217800, 'Licencias de software Q1', 'pendiente_pago'],
    [provIds[1], 'B', '0002-00000456', addDias(-30), addDias(-5), 45000, '21%', 9450, 54450, 'Papelería y artículos de oficina', 'pagada'],
    [provIds[1], 'A', '0002-00000512', addDias(-10), addDias(20), 52000, '21%', 10920, 62920, 'Insumos de librería', 'pendiente_pago'],
    [provIds[2], 'A', '0001-00000789', addDias(-20), addDias(5), 95000, '21%', 19950, 114950, 'Fletes del mes - zona norte', 'pendiente_pago'],
    [provIds[2], 'A', '0001-00000823', addDias(-5), addDias(25), 87000, '21%', 18270, 105270, 'Transporte distribución zona sur', 'pendiente_pago'],
    [provIds[3], 'A', '0001-00000345', addDias(-60), addDias(-30), 320000, '21%', 67200, 387200, 'Consultoría implementación ERP', 'pagada'],
    [provIds[4], 'B', '0001-00000167', addDias(-15), addDias(3), 85000, 'exento', 0, 85000, 'Póliza seguro responsabilidad civil', 'pendiente_pago'],
    [provIds[5], 'C', '0001-00001567', addDias(-8), addDias(7), 28000, '21%', 5880, 33880, 'Trabajos eléctricos depósito', 'pendiente_pago'],
    [provIds[6], 'A', '0001-00000234', addDias(-25), addDias(35), 125000, '21%', 26250, 151250, 'Campaña publicitaria Q2', 'pendiente_pago'],
  ];

  for (const f of facturasRec) {
    await client.execute({ sql: `INSERT INTO facturas_recibidas (proveedor_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento, importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: f });
  }
  console.log(`  → ${facturasRec.length} facturas recibidas`);

  // Facturas emitidas
  console.log('📤 Insertando facturas emitidas...');
  const facturasEm = [
    [cliIds[0], 'A', '0001-00003456', addDias(-45), addDias(-5), 450000, '21%', 94500, 544500, 'Prestación de servicios Q1', 'cobrada'],
    [cliIds[0], 'A', '0001-00003512', addDias(-15), addDias(15), 520000, '21%', 109200, 629200, 'Servicios mes de mayo', 'cobro_pendiente'],
    [cliIds[1], 'A', '0001-00003478', addDias(-30), addDias(0), 280000, '21%', 58800, 338800, 'Consultoría mensual', 'cobro_pendiente'],
    [cliIds[1], 'A', '0001-00003534', addDias(-10), addDias(20), 310000, '21%', 65100, 375100, 'Desarrollo módulo facturación', 'cobro_pendiente'],
    [cliIds[2], 'A', '0001-00003489', addDias(-20), addDias(10), 180000, '21%', 37800, 217800, 'Soporte técnico abril', 'cobrada'],
    [cliIds[2], 'A', '0001-00003545', addDias(-5), addDias(25), 195000, '21%', 40950, 235950, 'Soporte técnico mayo', 'cobro_pendiente'],
    [cliIds[3], 'B', '0001-00003498', addDias(-60), addDias(-30), 95000, '21%', 19950, 114950, 'Capacitación equipo', 'cobrada'],
    [cliIds[3], 'A', '0001-00003556', addDias(-8), addDias(22), 120000, '21%', 25200, 145200, 'Implementación módulo ventas', 'cobro_pendiente'],
    [cliIds[4], 'A', '0001-00003508', addDias(-25), addDias(-10), 350000, '21%', 73500, 423500, 'Proyecto anual - cuota 3', 'vencida'],
    [cliIds[4], 'A', '0001-00003567', addDias(-2), addDias(28), 350000, '21%', 73500, 423500, 'Proyecto anual - cuota 4', 'cobro_pendiente'],
  ];

  for (const f of facturasEm) {
    await client.execute({ sql: `INSERT INTO facturas_emitidas (cliente_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento, importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: f });
  }
  console.log(`  → ${facturasEm.length} facturas emitidas`);

  // Cuentas bancarias
  console.log('🏦 Insertando cuentas bancarias...');
  for (const c of [
    ['Banco Nación', 'Cuenta Corriente', 'ARS', 2850000],
    ['Banco Galicia', 'Caja de Ahorro', 'ARS', 980000],
    ['BBVA', 'Cuenta Corriente', 'ARS', 1450000],
    ['Banco Macro', 'Caja de Ahorro', 'USD', 15000],
  ]) {
    await client.execute({ sql: `INSERT INTO cuentas_bancarias (banco, tipo, moneda, saldo_actual) VALUES (?, ?, ?, ?)`, args: c });
  }
  console.log('  → 4 cuentas bancarias');

  // Vencimientos fiscales
  console.log('📅 Insertando vencimientos fiscales...');
  for (const v of [
    ['IVA - Período Mayo 2026', addDias(8), 145000, 'pendiente'],
    ['Ganancias - Anticipo 5', addDias(12), 85000, 'pendiente'],
    ['IIBB - Mayo 2026', addDias(6), 42000, 'pendiente'],
    ['Monotributo - Empleada doméstica', addDias(3), 8500, 'pendiente'],
    ['Cargas Sociales Mayo', addDias(15), 95000, 'pendiente'],
    ['IVA - Período Abril 2026', addDias(-15), 138000, 'pagado'],
    ['Ganancias - Anticipo 4', addDias(-30), 85000, 'pagado'],
    ['IIBB - Abril 2026', addDias(-12), 39000, 'pagado'],
    ['Sicore - Retenciones Mayo', addDias(20), 28000, 'pendiente'],
    ['VEP Seguridad Social', addDias(18), 112000, 'pendiente'],
  ]) {
    await client.execute({ sql: `INSERT INTO vencimientos_fiscales (descripcion, fecha_vencimiento, importe, estado) VALUES (?, ?, ?, ?)`, args: v });
  }
  console.log('  → 10 vencimientos fiscales');

  console.log('');
  console.log('🎉 ¡Base de datos inicializada correctamente!');
  console.log('');
  console.log('📋 Usuarios:');
  console.log('   Admin:     admin   (establecé contraseña con: npm run cambiar-clave)');
  console.log('   Contador:  contador (establecé contraseña con: npm run cambiar-clave)');
  console.log('');
  console.log('🚀 Ejecutá: npm run dev');
}

run().catch(err => { console.error('❌ Error:', err); process.exit(1); });
