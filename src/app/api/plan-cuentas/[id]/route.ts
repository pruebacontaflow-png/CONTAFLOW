import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { nombre, tipo, subtipo, parent_id, imputable, activo } = await req.json();
  await db.run(
    `UPDATE plan_cuentas SET nombre=?,tipo=?,subtipo=?,parent_id=?,imputable=?,activo=? WHERE id=?`,
    [nombre, tipo, subtipo ?? "", parent_id ?? null, imputable ? 1 : 0, activo ? 1 : 0, params.id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const used = await db.get(`SELECT id FROM asientos_lineas WHERE cuenta_id=? LIMIT 1`, [params.id]);
  if (used) {
    await db.run(`UPDATE plan_cuentas SET activo=0 WHERE id=?`, [params.id]);
  } else {
    await db.run(`DELETE FROM plan_cuentas WHERE id=?`, [params.id]);
  }
  return NextResponse.json({ ok: true });
}
