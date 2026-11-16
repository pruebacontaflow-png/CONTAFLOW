import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const semestre = parseInt(searchParams.get('semestre') || '1');

    const mesInicio = semestre === 1 ? '01' : '07';
    const mesFin = semestre === 1 ? '06' : '12';
    const fechaInicio = `${year}-${mesInicio}-01`;
    const fechaFin = `${year}-${mesFin}-31`;

    const ingresos = await db.get(
      `SELECT COALESCE(SUM(importe_total), 0) as total FROM facturas_emitidas WHERE fecha_emision >= ? AND fecha_emision <= ? AND tipo_comprobante NOT LIKE 'Nota de Cr%'`,
      [fechaInicio, fechaFin]
    );

    const egresos = await db.get(
      `SELECT COALESCE(SUM(importe_total), 0) as total FROM facturas_recibidas WHERE fecha_emision >= ? AND fecha_emision <= ? AND tipo_comprobante NOT LIKE 'Nota de Cr%'`,
      [fechaInicio, fechaFin]
    );

    const ncRecibidas = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(importe_total), 0) as total FROM facturas_recibidas WHERE fecha_emision >= ? AND fecha_emision <= ? AND tipo_comprobante LIKE 'Nota de Cr%'`,
      [fechaInicio, fechaFin]
    );

    const ncEmitidas = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(importe_total), 0) as total FROM facturas_emitidas WHERE fecha_emision >= ? AND fecha_emision <= ? AND tipo_comprobante LIKE 'Nota de Cr%'`,
      [fechaInicio, fechaFin]
    );

    // Fecha de corte: fin del período elegido, o hoy si el período todavía no terminó.
    // El estado se calcula a esa fecha con la fecha real de pago / cobro (no con el estado actual).
    const hoyReal = new Date().toISOString().split('T')[0];
    const hoy = fechaFin < hoyReal ? fechaFin.replace(/-31$/, mesFin === '06' ? '-30' : '-31') : hoyReal;
    const en30Dias = new Date(new Date(hoy + 'T00:00:00').getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const VTO = `COALESCE(NULLIF(fecha_vencimiento,''), fecha_emision)`;
    const PEND_FR = `tipo_comprobante NOT LIKE 'Nota de Cr%' AND COALESCE(estado_pago,'') NOT IN ('NO PAGAR') AND fecha_emision <= '${hoy}' AND id NOT IN (SELECT nc_imputa_id FROM facturas_recibidas WHERE nc_imputa_id IS NOT NULL) AND (fecha_pago IS NULL OR fecha_pago = '' OR fecha_pago > '${hoy}')`;
    const PEND_FE = `tipo_comprobante NOT LIKE 'Nota de Cr%' AND nc_imputa_id IS NULL AND fecha_emision <= '${hoy}' AND id NOT IN (SELECT nc_imputa_id FROM facturas_emitidas WHERE nc_imputa_id IS NOT NULL) AND (fecha_cobro IS NULL OR fecha_cobro = '' OR fecha_cobro > '${hoy}')`;

    const facturasPorVencer = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(importe_total), 0) as total FROM facturas_recibidas WHERE ${PEND_FR} AND ${VTO} > ? AND ${VTO} <= ?`,
      [hoy, en30Dias]
    );

    const cobrosPorVencer = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(importe_total), 0) as total FROM facturas_emitidas WHERE ${PEND_FE} AND ${VTO} > ? AND ${VTO} <= ?`,
      [hoy, en30Dias]
    );

    const saldosBancarios = await db.all(`SELECT banco, tipo, moneda, saldo_actual FROM cuentas_bancarias ORDER BY moneda, banco`);
    const saldoTotal = saldosBancarios.filter(s => s.moneda === 'ARS').reduce((acc, s) => acc + (s.saldo_actual as number), 0);

    const proxVencimientosFacturas = await db.all(
      `SELECT fr.fecha_vencimiento, fr.importe_total as importe, p.razon_social as descripcion, 'factura' as tipo, fr.numero
       FROM facturas_recibidas fr JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE fr.id IN (SELECT id FROM facturas_recibidas WHERE ${PEND_FR}) AND COALESCE(NULLIF(fr.fecha_vencimiento,''), fr.fecha_emision) > ?
       ORDER BY fr.fecha_vencimiento ASC LIMIT 5`,
      [hoy]
    );

    const proxVencimientosFiscales = await db.all(
      `SELECT fecha_vencimiento, importe, descripcion, 'fiscal' as tipo FROM vencimientos_fiscales WHERE estado = 'pendiente' AND fecha_vencimiento >= ? ORDER BY fecha_vencimiento ASC LIMIT 5`,
      [hoy]
    );

    const proxVencimientos = [...proxVencimientosFacturas, ...proxVencimientosFiscales]
      .sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)))
      .slice(0, 8);

    // Aging CxP (facturas_recibidas pendiente_pago)
    const agingCxP = await db.get(
      `SELECT
        COALESCE(SUM(CASE WHEN ${VTO} > ? THEN importe_total ELSE 0 END), 0) as por_vencer,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 0 AND 29 THEN importe_total ELSE 0 END), 0) as venc_0_30,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 30 AND 59 THEN importe_total ELSE 0 END), 0) as venc_31_60,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO}) >= 60 THEN importe_total ELSE 0 END), 0) as venc_mas_60,
        COUNT(CASE WHEN ${VTO} > ? THEN 1 END) as cnt_por_vencer,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 0 AND 29 THEN 1 END) as cnt_0_30,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 30 AND 59 THEN 1 END) as cnt_31_60,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO}) >= 60 THEN 1 END) as cnt_mas_60
       FROM facturas_recibidas WHERE ${PEND_FR}`,
      [hoy, hoy, hoy, hoy, hoy, hoy, hoy, hoy]
    );

    // Aging CxC (facturas_emitidas cobro_pendiente)
    const agingCxC = await db.get(
      `SELECT
        COALESCE(SUM(CASE WHEN ${VTO} > ? THEN importe_total ELSE 0 END), 0) as por_vencer,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 0 AND 29 THEN importe_total ELSE 0 END), 0) as venc_0_30,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 30 AND 59 THEN importe_total ELSE 0 END), 0) as venc_31_60,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO}) >= 60 THEN importe_total ELSE 0 END), 0) as venc_mas_60,
        COUNT(CASE WHEN ${VTO} > ? THEN 1 END) as cnt_por_vencer,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 0 AND 29 THEN 1 END) as cnt_0_30,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO}) BETWEEN 30 AND 59 THEN 1 END) as cnt_31_60,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO}) >= 60 THEN 1 END) as cnt_mas_60
       FROM facturas_emitidas WHERE ${PEND_FE}`,
      [hoy, hoy, hoy, hoy, hoy, hoy, hoy, hoy]
    );

    const ingresosPorTipo = await db.all(
      `SELECT tipo_comprobante, COALESCE(SUM(importe_total), 0) as total FROM facturas_emitidas WHERE fecha_emision >= ? AND fecha_emision <= ? GROUP BY tipo_comprobante`,
      [fechaInicio, fechaFin]
    );

    const egresosPorTipo = await db.all(
      `SELECT tipo_comprobante, COALESCE(SUM(importe_total), 0) as total FROM facturas_recibidas WHERE fecha_emision >= ? AND fecha_emision <= ? GROUP BY tipo_comprobante`,
      [fechaInicio, fechaFin]
    );

    const meses = semestre === 1 ? ['01','02','03','04','05','06'] : ['07','08','09','10','11','12'];
    const evolucionMensual = await Promise.all(meses.map(async (mes) => {
      const fi = `${year}-${mes}-01`;
      const ff = `${year}-${mes}-31`;
      const ing = await db.get(`SELECT COALESCE(SUM(importe_total),0) as t FROM facturas_emitidas WHERE fecha_emision >= ? AND fecha_emision <= ?`, [fi, ff]);
      const eg = await db.get(`SELECT COALESCE(SUM(importe_total),0) as t FROM facturas_recibidas WHERE fecha_emision >= ? AND fecha_emision <= ?`, [fi, ff]);
      return { mes: `${mes}/${String(year).slice(2)}`, ingresos: ing?.t || 0, egresos: eg?.t || 0 };
    }));

    // Inversiones
    const invData = await db.all(`SELECT moneda, SUM(saldo_actual) as total FROM inversiones WHERE estado='activa' GROUP BY moneda`);
    const countInv = await db.get(`SELECT COUNT(*) as n FROM inversiones WHERE estado='activa'`);
    const invARS = invData.find(r => r.moneda === 'ARS')?.total || 0;
    const invUSD = invData.find(r => r.moneda === 'USD')?.total || 0;
    const inversiones = { ars: invARS as number, usd: invUSD as number, count: countInv?.n || 0, total: (invARS as number) + (invUSD as number) };

    return NextResponse.json({
      ingresos: ingresos?.total || 0,
      egresos: egresos?.total || 0,
      resultadoNeto: (ingresos?.total || 0) - (egresos?.total || 0),
      ncRecibidas: { count: ncRecibidas?.count || 0, total: ncRecibidas?.total || 0 },
      ncEmitidas: { count: ncEmitidas?.count || 0, total: ncEmitidas?.total || 0 },
      facturasPorVencer: { count: facturasPorVencer?.count || 0, total: facturasPorVencer?.total || 0 },
      cobrosPorVencer: { count: cobrosPorVencer?.count || 0, total: cobrosPorVencer?.total || 0 },
      saldosBancarios,
      saldoTotal,
      proxVencimientos,
      ingresosPorTipo,
      egresosPorTipo,
      evolucionMensual,
      agingCxP,
      agingCxC,
      fechaCorte: hoy,
      inversiones,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
