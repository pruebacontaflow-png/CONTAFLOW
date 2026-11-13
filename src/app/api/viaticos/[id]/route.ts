import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const body = await req.json();
    const { empleado, fecha, tipo, destino, importe, moneda, descripcion, aprobado } = body;
    await db.run(
      `UPDATE viaticos SET empleado=?,fecha=?,tipo=?,destino=?,importe=?,moneda=?,descripcion=?,aprobado=? WHERE id=?`,
      [empleado, fecha, tipo, destino || "", importe, moneda || "ARS", descripcion || "", aprobado ? 1 : 0, params.id]
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
    await db.run(`DELETE FROM viaticos WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
