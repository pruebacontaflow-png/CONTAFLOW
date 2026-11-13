import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const asiento = await db.get(`SELECT * FROM asientos WHERE id=?`, [params.id]);
  if (!asiento) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const lineas = await db.all(
    `SELECT al.*, pc.codigo, pc.nombre as cuenta_nombre
     FROM asientos_lineas al
     JOIN plan_cuentas pc ON pc.id = al.cuenta_id
     WHERE al.asiento_id=? ORDER BY al.id`,
    [params.id]
  );
  return NextResponse.json({ ...asiento, lineas });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const asiento = await db.get(`SELECT anio, mes, tipo FROM asientos WHERE id=?`, [params.id]);
  if (!asiento) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (asiento.tipo !== "manual") {
    return NextResponse.json({ error: "Solo se pueden eliminar asientos manuales" }, { status: 400 });
  }
  const periodo = await db.get(`SELECT cerrado FROM periodos_contables WHERE anio=? AND mes=?`, [asiento.anio, asiento.mes]);
  if (periodo?.cerrado) {
    return NextResponse.json({ error: "El período está cerrado" }, { status: 400 });
  }
  await db.run(`DELETE FROM asientos_lineas WHERE asiento_id=?`, [params.id]);
  await db.run(`DELETE FROM asientos WHERE id=?`, [params.id]);
  return NextResponse.json({ ok: true });
}
