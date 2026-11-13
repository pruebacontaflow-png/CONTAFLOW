import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { descripcion, tipo, proveedor_id, monto, moneda, periodicidad, fecha_proximo_vto, cbu_debito, estado, notas } = await req.json();
    await db.run(
      `UPDATE servicios_recurrentes SET descripcion=?,tipo=?,proveedor_id=?,monto=?,moneda=?,periodicidad=?,fecha_proximo_vto=?,cbu_debito=?,estado=?,notas=? WHERE id=?`,
      [descripcion, tipo, proveedor_id || null, monto, moneda, periodicidad, fecha_proximo_vto || null, cbu_debito, estado || "activo", notas || "", params.id]
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
    await db.run(`DELETE FROM servicios_recurrentes WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
