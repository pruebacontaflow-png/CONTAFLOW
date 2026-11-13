import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { descripcion, fecha_vencimiento, importe, estado } = await req.json();
    await db.run(
      `UPDATE vencimientos_fiscales SET descripcion=?, fecha_vencimiento=?, importe=?, estado=? WHERE id=?`,
      [descripcion, fecha_vencimiento, importe||0, estado, params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.run(`DELETE FROM vencimientos_fiscales WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
