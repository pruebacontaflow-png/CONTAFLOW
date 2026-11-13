import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { nombre, apellido, cuit, cuil, cargo, departamento, fecha_ingreso, fecha_egreso, salario_base, banco, cbu, convenio, categoria, activo, notas } = await req.json();
    await db.run(
      `UPDATE empleados SET nombre=?,apellido=?,cuit=?,cuil=?,cargo=?,departamento=?,fecha_ingreso=?,fecha_egreso=?,salario_base=?,banco=?,cbu=?,convenio=?,categoria=?,activo=?,notas=? WHERE id=?`,
      [nombre, apellido, cuit || "", cuil || "", cargo || "", departamento || "", fecha_ingreso || null, fecha_egreso || null, salario_base || 0, banco || "", cbu || "", convenio || "", categoria || "", activo ?? 1, notas || "", params.id]
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
    await db.run(`UPDATE empleados SET activo=0 WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
