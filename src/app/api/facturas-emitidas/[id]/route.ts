import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    await db.run(
      `UPDATE facturas_emitidas SET cliente_id=?, tipo_comprobante=?, numero=?, fecha_emision=?, fecha_vencimiento=?, importe_neto=?, tipo_iva=?, importe_iva=?, importe_total=?, concepto=?, estado=? WHERE id=?`,
      [body.cliente_id, body.tipo_comprobante, body.numero, body.fecha_emision, body.fecha_vencimiento, body.importe_neto, body.tipo_iva, body.importe_iva, body.importe_total, body.concepto, body.estado, params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.run(`DELETE FROM facturas_emitidas WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
