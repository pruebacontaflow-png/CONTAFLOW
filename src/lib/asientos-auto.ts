/**
 * Generación automática de asientos contables.
 * Las cuentas se resuelven desde `plan_cuentas` usando los códigos en `parametros`.
 * Nunca hardcodea IDs ni valores impositivos.
 */
import db from "@/lib/db";

async function getCuentaId(clave: string): Promise<number | null> {
  const param = await db.get(`SELECT valor FROM parametros WHERE clave=?`, [clave]);
  if (!param) return null;
  const cuenta = await db.get(`SELECT id FROM plan_cuentas WHERE codigo=? AND activo=1`, [param.valor]);
  return cuenta ? Number(cuenta.id) : null;
}

function periodoDeDate(fecha: string) {
  const d = new Date(fecha);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

async function insertarAsiento(
  fecha: string,
  descripcion: string,
  tipo: string,
  referenciaId: number,
  referenciaTipo: string,
  lineas: { cuenta_id: number; descripcion: string; debe: number; haber: number }[]
): Promise<number | null> {
  // Verificar que el período no esté cerrado
  const { anio, mes } = periodoDeDate(fecha);
  const periodo = await db.get(
    `SELECT cerrado FROM periodos_contables WHERE anio=? AND mes=?`,
    [anio, mes]
  );
  if (periodo?.cerrado) {
    console.warn(`Asiento no generado: período ${anio}/${mes} cerrado.`);
    return null;
  }

  // Verificar partida doble (tolerancia centavos)
  const sumDebe  = lineas.reduce((s, l) => s + l.debe, 0);
  const sumHaber = lineas.reduce((s, l) => s + l.haber, 0);
  if (Math.abs(sumDebe - sumHaber) > 0.01) {
    console.warn(`Asiento no balanceado: debe=${sumDebe} haber=${sumHaber}`);
    return null;
  }

  const r = await db.run(
    `INSERT INTO asientos (fecha,descripcion,tipo,referencia_id,referencia_tipo,anio,mes,estado)
     VALUES (?,?,?,?,?,?,?,'confirmado')`,
    [fecha, descripcion, tipo, referenciaId, referenciaTipo, anio, mes]
  );
  const asientoId = Number(r.lastInsertRowid);

  for (const l of lineas) {
    await db.run(
      `INSERT INTO asientos_lineas (asiento_id,cuenta_id,descripcion,debe,haber) VALUES (?,?,?,?,?)`,
      [asientoId, l.cuenta_id, l.descripcion, l.debe, l.haber]
    );
  }
  return asientoId;
}

/** Asiento cuando una factura de compra pasa a pendiente_pago */
export async function asientoCompra(facturaId: number): Promise<void> {
  // Verificar que no exista ya un asiento para esta factura
  const existente = await db.get(
    `SELECT id FROM asientos WHERE referencia_id=? AND referencia_tipo='factura_recibida'`,
    [facturaId]
  );
  if (existente) return;

  const factura = await db.get(
    `SELECT fecha_emision, importe_neto, importe_iva, importe_total, concepto, tipo_comprobante, numero
     FROM facturas_recibidas WHERE id=?`,
    [facturaId]
  );
  if (!factura) return;

  const [cGastos, cIvaCredito, cProveedores] = await Promise.all([
    getCuentaId("cuenta_gastos_default"),
    getCuentaId("cuenta_iva_credito"),
    getCuentaId("cuenta_proveedores"),
  ]);
  if (!cGastos || !cIvaCredito || !cProveedores) return;

  const neto = Number(factura.importe_neto) || 0;
  const iva  = Number(factura.importe_iva)  || 0;
  const total = Number(factura.importe_total) || 0;
  const ref = `${factura.tipo_comprobante}-${factura.numero}`;

  await insertarAsiento(
    String(factura.fecha_emision),
    `Compra ${ref} – ${factura.concepto || ""}`,
    "automatico_compra",
    facturaId,
    "factura_recibida",
    [
      { cuenta_id: cGastos,     descripcion: "Gasto", debe: neto,  haber: 0 },
      { cuenta_id: cIvaCredito, descripcion: "IVA CF", debe: iva,  haber: 0 },
      { cuenta_id: cProveedores,descripcion: "Proveedor", debe: 0, haber: total },
    ]
  );
}

/** Asiento cuando se emite una factura de venta */
export async function asientoVenta(facturaId: number): Promise<void> {
  const existente = await db.get(
    `SELECT id FROM asientos WHERE referencia_id=? AND referencia_tipo='factura_emitida'`,
    [facturaId]
  );
  if (existente) return;

  const factura = await db.get(
    `SELECT fecha_emision, importe_neto, importe_iva, importe_total, concepto, tipo_comprobante, numero
     FROM facturas_emitidas WHERE id=?`,
    [facturaId]
  );
  if (!factura) return;

  const [cClientes, cVentas, cIvaDebito] = await Promise.all([
    getCuentaId("cuenta_creditos_clientes"),
    getCuentaId("cuenta_ventas_default"),
    getCuentaId("cuenta_iva_debito"),
  ]);
  if (!cClientes || !cVentas || !cIvaDebito) return;

  const neto  = Number(factura.importe_neto)  || 0;
  const iva   = Number(factura.importe_iva)   || 0;
  const total = Number(factura.importe_total) || 0;
  const ref   = `${factura.tipo_comprobante}-${factura.numero}`;

  await insertarAsiento(
    String(factura.fecha_emision),
    `Venta ${ref} – ${factura.concepto || ""}`.trim(),
    "automatico_venta",
    facturaId,
    "factura_emitida",
    [
      { cuenta_id: cClientes,  descripcion: "Crédito cliente", debe: total, haber: 0    },
      { cuenta_id: cVentas,    descripcion: "Venta",           debe: 0,     haber: neto },
      { cuenta_id: cIvaDebito, descripcion: "IVA DF",          debe: 0,     haber: iva  },
    ]
  );
}

/** Asiento cuando una orden de pago se registra como pagada */
export async function asientoPago(ordenId: number): Promise<void> {
  const existente = await db.get(
    `SELECT id FROM asientos WHERE referencia_id=? AND referencia_tipo='orden_pago'`,
    [ordenId]
  );
  if (existente) return;

  const orden = await db.get(
    `SELECT fecha, numero, importe_bruto, total_retenciones, importe_neto FROM ordenes_pago WHERE id=?`,
    [ordenId]
  );
  if (!orden) return;

  const [cProveedores, cBanco, cRetenciones] = await Promise.all([
    getCuentaId("cuenta_proveedores"),
    getCuentaId("cuenta_banco_default"),
    getCuentaId("cuenta_retenciones_pagar"),
  ]);
  if (!cProveedores || !cBanco || !cRetenciones) return;

  const bruto = Number(orden.importe_bruto);
  const ret   = Number(orden.total_retenciones);
  const neto  = Number(orden.importe_neto);

  const lineas: { cuenta_id: number; descripcion: string; debe: number; haber: number }[] = [
    { cuenta_id: cProveedores, descripcion: "Cancelación proveedor", debe: bruto, haber: 0 },
    { cuenta_id: cBanco,       descripcion: "Egreso banco",          debe: 0, haber: neto },
  ];
  if (ret > 0) {
    lineas.push({ cuenta_id: cRetenciones, descripcion: "Retenciones practicadas", debe: 0, haber: ret });
  }

  await insertarAsiento(
    String(orden.fecha),
    `Pago OP ${orden.numero}`,
    "automatico_pago",
    ordenId,
    "orden_pago",
    lineas
  );
}
