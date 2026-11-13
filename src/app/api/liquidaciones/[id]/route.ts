import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { empleado_id, periodo, salario_bruto, horas_extra, bonificaciones, descuento_jubilacion, descuento_obra_social, descuento_sindical, otros_descuentos, estado, fecha_pago, notas } = await req.json();
    const bruto = (parseFloat(salario_bruto) || 0) + (parseFloat(horas_extra) || 0) + (parseFloat(bonificaciones) || 0);
    const descuentos = (parseFloat(descuento_jubilacion) || 0) + (parseFloat(descuento_obra_social) || 0) + (parseFloat(descuento_sindical) || 0) + (parseFloat(otros_descuentos) || 0);
    const neto = bruto - descuentos;
    await db.run(
      `UPDATE liquidaciones SET empleado_id=?,periodo=?,salario_bruto=?,horas_extra=?,bonificaciones=?,descuento_jubilacion=?,descuento_obra_social=?,descuento_sindical=?,otros_descuentos=?,neto=?,estado=?,fecha_pago=?,notas=? WHERE id=?`,
      [empleado_id, periodo, parseFloat(salario_bruto) || 0, parseFloat(horas_extra) || 0, parseFloat(bonificaciones) || 0, parseFloat(descuento_jubilacion) || 0, parseFloat(descuento_obra_social) || 0, parseFloat(descuento_sindical) || 0, parseFloat(otros_descuentos) || 0, neto, estado || "borrador", fecha_pago || null, notas || "", params.id]
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
    await db.run(`DELETE FROM liquidaciones WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
