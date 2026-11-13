import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { nombre, patron, tipo_match, categoria, cuenta_contable_id, descripcion_reemplazo, prioridad, activo } = body;
  await db.run(
    `UPDATE reglas_clasificacion SET nombre=?,patron=?,tipo_match=?,categoria=?,cuenta_contable_id=?,descripcion_reemplazo=?,prioridad=?,activo=? WHERE id=?`,
    [nombre, patron, tipo_match, categoria || "", cuenta_contable_id ?? null, descripcion_reemplazo || "", Number(prioridad) || 0, activo ? 1 : 0, params.id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await db.run(`DELETE FROM reglas_clasificacion WHERE id=?`, [params.id]);
  return NextResponse.json({ ok: true });
}
