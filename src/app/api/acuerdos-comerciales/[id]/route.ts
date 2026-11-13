import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { cliente_id, descripcion, tipo, fecha_inicio, fecha_fin, importe_mensual, moneda, comision_pct, responsable, estado, notas } = await req.json();
    await db.run(
      `UPDATE acuerdos_comerciales SET cliente_id=?,descripcion=?,tipo=?,fecha_inicio=?,fecha_fin=?,importe_mensual=?,moneda=?,comision_pct=?,responsable=?,estado=?,notas=? WHERE id=?`,
      [cliente_id || null, descripcion, tipo || "servicio", fecha_inicio || null, fecha_fin || null, parseFloat(importe_mensual) || 0, moneda || "ARS", parseFloat(comision_pct) || 0, responsable || "", estado || "activo", notas || "", params.id]
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    await db.run(`DELETE FROM acuerdos_comerciales WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
