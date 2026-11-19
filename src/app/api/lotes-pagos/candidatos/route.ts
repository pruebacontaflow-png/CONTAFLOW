import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const fechaPago = searchParams.get("fecha_pago");
  if (!fechaPago) return NextResponse.json({ error: "Falta fecha_pago" }, { status: 400 });

  // Facturas pendientes de pago con vencimiento hasta la fecha de pago (incluye vencidas)
  const facturas: any[] = await db.all(
    `SELECT
       fr.id,
       COALESCE(p.razon_social, fr.cuit_emisor) AS proveedor,
       fr.tipo_comprobante,
       fr.punto_venta,
       fr.numero,
       fr.fecha_emision,
       fr.fecha_vencimiento,
       fr.importe_total,
       fr.concepto,
       fr.moneda,
       p.cbu,
       p.cuit                      AS cuit_proveedor,
       p.codigo_proveedor,
       CASE WHEN fr.fecha_vencimiento < date('now') THEN 1 ELSE 0 END AS vencida
     FROM facturas_recibidas fr
     LEFT JOIN proveedores p ON p.id = fr.proveedor_id
     WHERE fr.estado = 'pendiente_pago'
       AND fr.fecha_vencimiento <= ?
       AND (fr.moneda IS NULL OR fr.moneda = '' OR fr.moneda = 'ARS')
     ORDER BY fr.fecha_vencimiento ASC, proveedor ASC`,
    [fechaPago]
  );

  return NextResponse.json({ facturas, total: facturas.reduce((s, f) => s + (Number(f.importe_total) || 0), 0) });
}
