import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const cuentas = await db.all(`SELECT * FROM cuentas_bancarias ORDER BY moneda, banco`);
    const historial = await db.all(
      `SELECT mb.*, cb.banco, cb.tipo FROM movimientos_bancarios mb JOIN cuentas_bancarias cb ON cb.id = mb.cuenta_id ORDER BY mb.created_at DESC LIMIT 50`
    );
    return NextResponse.json({ cuentas, historial });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { banco, tipo, moneda, saldo_actual } = await req.json();
    if (!banco) return NextResponse.json({ error: 'Banco requerido' }, { status: 400 });
    const result = await db.run(
      `INSERT INTO cuentas_bancarias (banco, tipo, moneda, saldo_actual) VALUES (?, ?, ?, ?)`,
      [banco, tipo||'Cuenta Corriente', moneda||'ARS', saldo_actual||0]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
