import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const orden = await db.get(
    `SELECT op.*, p.razon_social, p.cuit
     FROM ordenes_pago op
     JOIN proveedores p ON p.id = op.proveedor_id
     WHERE op.id = ?`,
    [params.id]
  );
  if (!orden) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const items = await db.all(
    `SELECT opi.*, fr.tipo_comprobante, fr.numero, fr.fecha_emision, fr.importe_total, fr.concepto
     FROM ordenes_pago_items opi
     JOIN facturas_recibidas fr ON fr.id = opi.factura_id
     WHERE opi.orden_pago_id = ?`,
    [params.id]
  );
  const retenciones = await db.all(
    `SELECT * FROM retenciones_aplicadas WHERE orden_pago_id = ?`,
    [params.id]
  );
  return NextResponse.json({ ...orden, items, retenciones });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { estado, observaciones, comprobante_path } = body;
  await db.run(
    `UPDATE ordenes_pago SET estado=COALESCE(?,estado), observaciones=COALESCE(?,observaciones), comprobante_path=COALESCE(?,comprobante_path) WHERE id=?`,
    [estado ?? null, observaciones ?? null, comprobante_path ?? null, params.id]
  );

  // Si se pasa a pagada, actualizar facturas
  if (estado === "pagada") {
    const orden = await db.get(`SELECT fecha, numero FROM ordenes_pago WHERE id=?`, [params.id]);
    const items = await db.all(`SELECT factura_id FROM ordenes_pago_items WHERE orden_pago_id=?`, [params.id]);
    const ids = items.map((i: any) => Number(i.factura_id));
    for (const fid of ids) {
      await db.run(
        `UPDATE facturas_recibidas SET estado='pagada', fecha_pago=?, numero_op=? WHERE id=?`,
        [orden?.fecha, orden?.numero, fid]
      );
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const orden = await db.get(`SELECT estado FROM ordenes_pago WHERE id=?`, [params.id]);
  if (!orden) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (orden.estado === "pagada") {
    return NextResponse.json({ error: "No se puede eliminar una orden ya pagada" }, { status: 400 });
  }
  await db.run(`DELETE FROM retenciones_aplicadas WHERE orden_pago_id=?`, [params.id]);
  await db.run(`DELETE FROM ordenes_pago_items WHERE orden_pago_id=?`, [params.id]);
  await db.run(`DELETE FROM ordenes_pago WHERE id=?`, [params.id]);
  return NextResponse.json({ ok: true });
}
