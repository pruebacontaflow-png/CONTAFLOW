import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const soloAbiertas = searchParams.get("solo_abiertas") !== "false";
    const proveedorId = searchParams.get("proveedor_id");
    const hoy = new Date().toISOString().split("T")[0];

    // Facturas recibidas como partidas (KR = factura, KN = nota crédito, KD = nota débito)
    let frWhere = `fr.tipo_comprobante NOT LIKE 'Nota de Cr%'`;
    if (soloAbiertas) frWhere += ` AND (fr.estado_pago = 'pendiente_pago' OR fr.estado_pago IS NULL OR fr.estado_pago = '')`;
    if (proveedorId) frWhere += ` AND fr.proveedor_id = ?`;

    const frArgs: any[] = proveedorId ? [proveedorId] : [];

    const facturas = await db.all(`
      SELECT
        'FR' as tipo,
        fr.id,
        fr.proveedor_id,
        p.razon_social,
        p.cuit,
        'IT' as div,
        fr.numero as referencia,
        fr.id as nro_doc,
        CASE
          WHEN fr.tipo_comprobante LIKE 'Nota de Cr%' THEN 'KN'
          WHEN fr.tipo_comprobante LIKE 'Nota de D%' THEN 'KD'
          ELSE 'KR'
        END as clase,
        fr.fecha_emision as fecha_doc,
        fr.fecha_emision as fe_contab,
        fr.fecha_vencimiento,
        fr.importe_total as importe,
        COALESCE(fr.moneda, 'ARS') as moneda,
        COALESCE(fr.concepto, '') as texto,
        COALESCE(fr.estado_pago, '') as estado_pago,
        COALESCE(fr.numero_op, '') as doc_comp,
        CASE WHEN fr.fecha_vencimiento < ? THEN 1 ELSE 0 END as es_vencida,
        CAST(julianday(?) - julianday(fr.fecha_vencimiento) AS INTEGER) as dias_vencida
      FROM facturas_recibidas fr
      JOIN proveedores p ON p.id = fr.proveedor_id
      WHERE ${frWhere}
    `, [hoy, hoy, ...frArgs]);

    // Notas de crédito (siempre incluirlas si hay facturas pendientes del proveedor)
    let ncWhere = `fr.tipo_comprobante LIKE 'Nota de Cr%'`;
    if (proveedorId) ncWhere += ` AND fr.proveedor_id = ?`;
    const ncArgs: any[] = proveedorId ? [proveedorId] : [];

    const ncs = await db.all(`
      SELECT
        'NC' as tipo,
        fr.id,
        fr.proveedor_id,
        p.razon_social,
        p.cuit,
        'IT' as div,
        fr.numero as referencia,
        fr.id as nro_doc,
        'KN' as clase,
        fr.fecha_emision as fecha_doc,
        fr.fecha_emision as fe_contab,
        fr.fecha_vencimiento,
        fr.importe_total as importe,
        COALESCE(fr.moneda, 'ARS') as moneda,
        COALESCE(fr.concepto, '') as texto,
        COALESCE(fr.estado_pago, '') as estado_pago,
        COALESCE(fr.nc_imputa_id, '') as doc_comp,
        0 as es_vencida,
        0 as dias_vencida
      FROM facturas_recibidas fr
      JOIN proveedores p ON p.id = fr.proveedor_id
      WHERE ${ncWhere}
    `, [hoy, ...ncArgs]);

    // Órdenes de pago (KZ = pago)
    let opWhere = `op.estado NOT IN ('anulada', 'cancelada')`;
    if (soloAbiertas) opWhere += ` AND op.estado = 'pendiente_pago'`;
    if (proveedorId) opWhere += ` AND op.proveedor_id = ?`;
    const opArgs: any[] = proveedorId ? [proveedorId] : [];

    const pagos = await db.all(`
      SELECT
        'OP' as tipo,
        op.id,
        op.proveedor_id,
        p.razon_social,
        p.cuit,
        'IT' as div,
        op.numero as referencia,
        op.id as nro_doc,
        'KZ' as clase,
        op.fecha as fecha_doc,
        op.fecha as fe_contab,
        op.fecha as fecha_vencimiento,
        -ABS(op.importe_neto) as importe,
        'ARS' as moneda,
        COALESCE(op.concepto, '') as texto,
        op.estado as estado_pago,
        op.numero as doc_comp,
        0 as es_vencida,
        0 as dias_vencida
      FROM ordenes_pago op
      JOIN proveedores p ON p.id = op.proveedor_id
      WHERE ${opWhere}
    `, [hoy, ...opArgs]);

    const all = [...facturas, ...ncs, ...pagos];

    // Group by proveedor
    const byProv = new Map<number, any>();
    for (const mov of all) {
      const pid = mov.proveedor_id as number;
      if (!byProv.has(pid)) {
        byProv.set(pid, {
          proveedor_id: pid,
          razon_social: mov.razon_social,
          cuit: mov.cuit,
          movimientos: [],
          saldo: 0,
        });
      }
      const prov = byProv.get(pid)!;
      prov.movimientos.push(mov);
      prov.saldo += mov.importe as number;
    }

    // Sort each proveedor's movements by fecha_doc
    byProv.forEach(p => {
      p.movimientos.sort((a: any, b: any) =>
        String(a.fecha_doc).localeCompare(String(b.fecha_doc))
      );
    });

    const result = Array.from(byProv.values()).sort((a, b) =>
      String(a.razon_social).localeCompare(String(b.razon_social))
    );

    const totalGeneral = result.reduce((s, p) => s + p.saldo, 0);

    return NextResponse.json({ proveedores: result, total_general: totalGeneral });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
