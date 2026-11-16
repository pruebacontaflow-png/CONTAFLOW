import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { banco, tipo, moneda, saldo_actual } = await req.json();
    const anterior = await db.get(`SELECT saldo_actual FROM cuentas_bancarias WHERE id=?`, [params.id]);

    await db.run(
      `UPDATE cuentas_bancarias SET banco=?, tipo=?, moneda=?, saldo_actual=?, updated_at=datetime('now') WHERE id=?`,
      [banco, tipo, moneda, saldo_actual, params.id]
    );

    if (anterior && anterior.saldo_actual !== saldo_actual) {
      await db.run(
        `INSERT INTO movimientos_bancarios (cuenta_id, fecha, descripcion, saldo_anterior, saldo_nuevo) VALUES (?, date('now'), 'Actualización manual', ?, ?)`,
        [params.id, anterior.saldo_actual, saldo_actual]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    await db.run(`DELETE FROM cuentas_bancarias WHERE id=?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
