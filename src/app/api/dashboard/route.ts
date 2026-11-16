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
    const mesParam = searchParams.get('meses') || '';
    // meses: comma-sep '01,02,...' o vacío = todos
    const meses: string[] = mesParam
      ? mesParam.split(',').map(m => m.trim().padStart(2, '0')).filter(m => m.length === 2)
      : ['01','02','03','04','05','06','07','08','09','10','11','12'];

    const hoy = new Date().toISOString().split('T')[0];
    const en7Dias = new Date(new Date(hoy + 'T00:00:00').getTime() + 7 * 86400000).toISOString().split('T')[0];

    // ── Condición de período (meses seleccionados) ───────────────────────────
    const mesPlaceholders = meses.map(() => '?').join(',');
    const mesArgs: string[] = [...meses];

    // ── 1. Ventas del período: neto gravado + no gravado + exento de fe (NC restan, ya son negativas) ──
    const ventasRes = await db.get(
      `SELECT COALESCE(SUM(neto_gravado + neto_no_gravado + exento), 0) as total
       FROM facturas_emitidas
       WHERE strftime('%Y', fecha_emision) = ? AND strftime('%m', fecha_emision) IN (${mesPlaceholders})`,
      [String(year), ...mesArgs]
    );

    // ── 2. Ingresos y egresos por banco ──────────────────────────────────────
    const ingresoBancoRes = await db.get(
      `SELECT COALESCE(SUM(credito), 0) as total FROM extractos_lineas
       WHERE strftime('%Y', fecha) = ? AND strftime('%m', fecha) IN (${mesPlaceholders})`,
      [String(year), ...mesArgs]
    );
    const egresoBancoRes = await db.get(
      `SELECT COALESCE(SUM(debito), 0) as total FROM extractos_lineas
       WHERE strftime('%Y', fecha) = ? AND strftime('%m', fecha) IN (${mesPlaceholders})`,
      [String(year), ...mesArgs]
    );

    // ── 3. Cobros por vencer a 7 días ────────────────────────────────────────
    const VTO_FE = `COALESCE(NULLIF(fecha_vencimiento,''), fecha_emision)`;
    const PEND_FE = `tipo_comprobante NOT LIKE 'Nota de Cr%' AND nc_imputa_id IS NULL
      AND id NOT IN (SELECT nc_imputa_id FROM facturas_emitidas WHERE nc_imputa_id IS NOT NULL)
      AND (fecha_cobro IS NULL OR fecha_cobro = '' OR fecha_cobro > '${hoy}')`;
    const cobrosPorVencer7dRes = await db.get(
      `SELECT COUNT(*) as count, COALESCE(SUM(importe_total), 0) as total
       FROM facturas_emitidas
       WHERE ${PEND_FE} AND ${VTO_FE} >= ? AND ${VTO_FE} <= ?`,
      [hoy, en7Dias]
    );

    // ── 4. Saldo bancario total ──────────────────────────────────────────────
    const saldosBancarios = await db.all(`SELECT banco, tipo, moneda, saldo_actual FROM cuentas_bancarias ORDER BY moneda, banco`);
    const saldoTotal = saldosBancarios.filter(s => s.moneda === 'ARS').reduce((acc, s) => acc + (s.saldo_actual as number), 0);

    // ── 5. Inversiones ──────────────────────────────────────────────────────
    const invData = await db.all(`SELECT moneda, SUM(saldo_actual) as total FROM inversiones WHERE estado='activa' GROUP BY moneda`);
    const countInv = await db.get(`SELECT COUNT(*) as n FROM inversiones WHERE estado='activa'`);
    const invARS = invData.find(r => r.moneda === 'ARS')?.total || 0;
    const invUSD = invData.find(r => r.moneda === 'USD')?.total || 0;
    const inversiones = { ars: invARS as number, usd: invUSD as number, count: countInv?.n || 0, total: (invARS as number) + (invUSD as number) };

    // ── 6. Aging CxP / CxC ──────────────────────────────────────────────────
    const VTO_FR = `COALESCE(NULLIF(fecha_vencimiento,''), fecha_emision)`;
    const PEND_FR = `tipo_comprobante NOT LIKE 'Nota de Cr%' AND COALESCE(estado_pago,'') NOT IN ('NO PAGAR') AND fecha_emision <= '${hoy}' AND id NOT IN (SELECT nc_imputa_id FROM facturas_recibidas WHERE nc_imputa_id IS NOT NULL) AND (fecha_pago IS NULL OR fecha_pago = '' OR fecha_pago > '${hoy}')`;
    const agingCxP = await db.get(
      `SELECT
        COALESCE(SUM(CASE WHEN ${VTO_FR} > ? THEN importe_total ELSE 0 END), 0) as por_vencer,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO_FR}) BETWEEN 0 AND 29 THEN importe_total ELSE 0 END), 0) as venc_0_30,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO_FR}) BETWEEN 30 AND 59 THEN importe_total ELSE 0 END), 0) as venc_31_60,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO_FR}) >= 60 THEN importe_total ELSE 0 END), 0) as venc_mas_60,
        COUNT(CASE WHEN ${VTO_FR} > ? THEN 1 END) as cnt_por_vencer,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO_FR}) BETWEEN 0 AND 29 THEN 1 END) as cnt_0_30,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO_FR}) BETWEEN 30 AND 59 THEN 1 END) as cnt_31_60,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO_FR}) >= 60 THEN 1 END) as cnt_mas_60
       FROM facturas_recibidas WHERE ${PEND_FR}`,
      [hoy, hoy, hoy, hoy, hoy, hoy, hoy, hoy]
    );
    const agingCxC = await db.get(
      `SELECT
        COALESCE(SUM(CASE WHEN ${VTO_FE} > ? THEN importe_total ELSE 0 END), 0) as por_vencer,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO_FE}) BETWEEN 0 AND 29 THEN importe_total ELSE 0 END), 0) as venc_0_30,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO_FE}) BETWEEN 30 AND 59 THEN importe_total ELSE 0 END), 0) as venc_31_60,
        COALESCE(SUM(CASE WHEN julianday(?) - julianday(${VTO_FE}) >= 60 THEN importe_total ELSE 0 END), 0) as venc_mas_60,
        COUNT(CASE WHEN ${VTO_FE} > ? THEN 1 END) as cnt_por_vencer,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO_FE}) BETWEEN 0 AND 29 THEN 1 END) as cnt_0_30,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO_FE}) BETWEEN 30 AND 59 THEN 1 END) as cnt_31_60,
        COUNT(CASE WHEN julianday(?) - julianday(${VTO_FE}) >= 60 THEN 1 END) as cnt_mas_60
       FROM facturas_emitidas WHERE ${PEND_FE}`,
      [hoy, hoy, hoy, hoy, hoy, hoy, hoy, hoy]
    );

    // ── 7. Flujo mensual banco (12 meses del año, excluye cuentas no operativas) ──
    const excluidas = await db.all(`SELECT cuenta_tango FROM cuentas_excluidas_dashboard WHERE activa=1`);
    const cuentasExcluidas = excluidas.map((r: any) => r.cuenta_tango as string);
    const excClause = cuentasExcluidas.length > 0
      ? `AND (cuenta_tango IS NULL OR cuenta_tango NOT IN (${cuentasExcluidas.map(() => '?').join(',')}))`
      : '';

    const MESES_12 = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const LABELS_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

    const flujoMensualBanco = await Promise.all(MESES_12.map(async (mes, i) => {
      const args: (string | number)[] = [String(year), mes, ...cuentasExcluidas];
      const r = await db.get(
        `SELECT
          COALESCE(SUM(credito), 0) as cred,
          COALESCE(SUM(debito), 0) as deb
         FROM extractos_lineas
         WHERE strftime('%Y', fecha) = ? AND strftime('%m', fecha) = ? ${excClause}`,
        args
      );
      const cred = Number(r?.cred || 0);
      const deb = Number(r?.deb || 0);
      return { mes: LABELS_MES[i], creditos: cred, debitos: deb, neto: cred - deb };
    }));

    // ── 8. Flujo mensual contable (12 meses, neto ventas - neto compras) ────
    const flujoMensualContable = await Promise.all(MESES_12.map(async (mes, i) => {
      const feR = await db.get(
        `SELECT COALESCE(SUM(neto_gravado + neto_no_gravado + exento), 0) as neto
         FROM facturas_emitidas
         WHERE strftime('%Y', fecha_emision) = ? AND strftime('%m', fecha_emision) = ?`,
        [String(year), mes]
      );
      const frR = await db.get(
        `SELECT COALESCE(SUM(neto_gravado + neto_no_gravado + exento), 0) as neto
         FROM facturas_recibidas
         WHERE tipo_comprobante NOT LIKE 'Nota de Cr%'
           AND strftime('%Y', fecha_emision) = ? AND strftime('%m', fecha_emision) = ?`,
        [String(year), mes]
      );
      const ventas = Number(feR?.neto || 0);
      const compras = Number(frR?.neto || 0);
      return { mes: LABELS_MES[i], ventas, compras, neto: ventas - compras };
    }));

    // ── 9. Vencimientos agrupados por categoría ──────────────────────────────
    const VENTANA_DIAS = 60; // muestra vencimientos de los próximos 60 días
    const enNDias = new Date(new Date(hoy + 'T00:00:00').getTime() + VENTANA_DIAS * 86400000).toISOString().split('T')[0];

    // Proveedores: facturas recibidas pendientes
    const vProvItems = await db.all(
      `SELECT fr.fecha_vencimiento as fecha,
              p.razon_social as descripcion,
              fr.importe_total as importe,
              fr.numero
       FROM facturas_recibidas fr
       JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE fr.tipo_comprobante NOT LIKE 'Nota de Cr%'
         AND fr.id NOT IN (SELECT nc_imputa_id FROM facturas_recibidas WHERE nc_imputa_id IS NOT NULL)
         AND COALESCE(fr.estado_pago,'') NOT IN ('NO PAGAR')
         AND (fr.fecha_pago IS NULL OR fr.fecha_pago = '')
         AND COALESCE(NULLIF(fr.fecha_vencimiento,''), fr.fecha_emision) >= ?
         AND COALESCE(NULLIF(fr.fecha_vencimiento,''), fr.fecha_emision) <= ?
       ORDER BY COALESCE(NULLIF(fr.fecha_vencimiento,''), fr.fecha_emision) ASC
       LIMIT 50`,
      [hoy, enNDias]
    );

    // Impuestos: vencimientos fiscales
    const vImpItems = await db.all(
      `SELECT fecha_vencimiento as fecha, descripcion, importe
       FROM vencimientos_fiscales
       WHERE estado = 'pendiente' AND fecha_vencimiento >= ? AND fecha_vencimiento <= ?
       ORDER BY fecha_vencimiento ASC LIMIT 30`,
      [hoy, enNDias]
    );

    // Seguros: servicios_recurrentes tipo seguro
    const vSegItems = await db.all(
      `SELECT fecha_proximo_vto as fecha, descripcion, monto as importe
       FROM servicios_recurrentes
       WHERE estado = 'activo' AND tipo LIKE '%seguro%'
         AND fecha_proximo_vto >= ? AND fecha_proximo_vto <= ?
       ORDER BY fecha_proximo_vto ASC LIMIT 20`,
      [hoy, enNDias]
    );

    // Servicios: servicios_recurrentes tipo servicio (no seguro)
    const vSrvItems = await db.all(
      `SELECT fecha_proximo_vto as fecha, descripcion, monto as importe
       FROM servicios_recurrentes
       WHERE estado = 'activo' AND tipo NOT LIKE '%seguro%'
         AND fecha_proximo_vto >= ? AND fecha_proximo_vto <= ?
       ORDER BY fecha_proximo_vto ASC LIMIT 20`,
      [hoy, enNDias]
    );

    // Sueldos: nominas próximas (si hay con fecha futura o última del mes)
    const vSuelItems = await db.all(
      `SELECT fecha, 'Nómina bancaria' as descripcion, total as importe
       FROM nominas_banco
       WHERE fecha >= ?
       ORDER BY fecha ASC LIMIT 5`,
      [hoy]
    );

    const sumItems = (items: any[]) => items.reduce((s, r) => s + Number(r.importe || 0), 0);

    const vencimientosGrupados = [
      { id: 'proveedores', label: 'Proveedores', items: vProvItems, total: sumItems(vProvItems), count: vProvItems.length },
      { id: 'impuestos',   label: 'Impuestos',   items: vImpItems,  total: sumItems(vImpItems),  count: vImpItems.length  },
      { id: 'seguros',     label: 'Seguros',      items: vSegItems,  total: sumItems(vSegItems),  count: vSegItems.length  },
      { id: 'servicios',   label: 'Servicios',    items: vSrvItems,  total: sumItems(vSrvItems),  count: vSrvItems.length  },
      { id: 'sueldos',     label: 'Sueldos y salarios', items: vSuelItems, total: sumItems(vSuelItems), count: vSuelItems.length },
    ];

    return NextResponse.json({
      ventas: ventasRes?.total || 0,
      ingresoBanco: ingresoBancoRes?.total || 0,
      egresoBanco: egresoBancoRes?.total || 0,
      cobrosPorVencer7d: { count: cobrosPorVencer7dRes?.count || 0, total: cobrosPorVencer7dRes?.total || 0 },
      saldosBancarios,
      saldoTotal,
      inversiones,
      agingCxP,
      agingCxC,
      flujoMensualBanco,
      flujoMensualContable,
      vencimientosGrupados,
      cuentasExcluidasBanco: cuentasExcluidas,
      fechaCorte: hoy,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
