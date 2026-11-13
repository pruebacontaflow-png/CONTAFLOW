import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { banco, numero, fecha_emision, fecha_cobro, beneficiario, importe, estado, orden_pago_id, moneda, notas } = await req.json();
    await db.run(
      `UPDATE cheques SET banco=?,numero=?,fecha_emision=?,fecha_cobro=?,beneficiario=?,importe=?,estado=?,orden_pago_id=?,moneda=?,notas=? WHERE id=?`,
      [banco, numero, fecha_emision, fecha_cobro || null, beneficiario, importe, estado, orden_pago_id || null, moneda, notas || "", params.id]
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
    await db.run(`DELETE FROM cheques WHERE id = ?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
