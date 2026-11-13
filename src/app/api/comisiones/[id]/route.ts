import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { acuerdo_id, empleado, periodo, base_calculo, porcentaje, importe, estado, fecha_pago, notas } = await req.json();
    await db.run(
      `UPDATE comisiones SET acuerdo_id=?,empleado=?,periodo=?,base_calculo=?,porcentaje=?,importe=?,estado=?,fecha_pago=?,notas=? WHERE id=?`,
      [acuerdo_id || null, empleado, periodo, parseFloat(base_calculo) || 0, parseFloat(porcentaje) || 0, parseFloat(importe) || 0, estado || "pendiente", fecha_pago || null, notas || "", params.id]
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
    await db.run(`DELETE FROM comisiones WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
