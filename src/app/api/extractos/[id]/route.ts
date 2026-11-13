import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const extracto = await db.get(
    `SELECT eb.*, cb.banco, cb.tipo as tipo_cuenta, cb.moneda
     FROM extractos_bancarios eb
     JOIN cuentas_bancarias cb ON cb.id=eb.cuenta_bancaria_id
     WHERE eb.id=?`,
    [params.id]
  );
  if (!extracto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const lineas = await db.all(
    `SELECT el.*, pc.codigo as cuenta_codigo, pc.nombre as cuenta_nombre
     FROM extractos_lineas el
     LEFT JOIN plan_cuentas pc ON pc.id = el.cuenta_contable_id
     WHERE el.extracto_id=? ORDER BY el.fecha, el.id`,
    [params.id]
  );
  return NextResponse.json({ ...extracto, lineas });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  await db.run(`DELETE FROM extractos_lineas WHERE extracto_id=?`, [params.id]);
  await db.run(`DELETE FROM extractos_bancarios WHERE id=?`, [params.id]);
  return NextResponse.json({ ok: true });
}
