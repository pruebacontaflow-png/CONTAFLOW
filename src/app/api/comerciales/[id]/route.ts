import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { nombre, proveedor_id, zona, activo } = await req.json();
    await db.run(
      `UPDATE comerciales SET nombre=?, proveedor_id=?, zona=?, activo=? WHERE id=?`,
      [nombre, proveedor_id || null, zona || '', activo ?? 1, params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.run(`UPDATE comerciales SET activo=0 WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
