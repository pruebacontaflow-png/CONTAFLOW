import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const rows = await db.all(
      `SELECT c.*,
       COUNT(m.id) as total_movimientos,
       COALESCE(SUM(CASE WHEN m.tipo IN ('ingreso','reposicion') THEN m.importe ELSE -m.importe END), 0) as saldo_calculado
       FROM fondo_fijo_cajas c
       LEFT JOIN fondo_fijo_movimientos m ON m.caja_id = c.id
       WHERE c.activa=1
       GROUP BY c.id ORDER BY c.nombre`
    );
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, moneda, responsable } = await req.json();
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const r = await db.run(
      `INSERT INTO fondo_fijo_cajas (nombre,moneda,responsable,saldo_actual,activa) VALUES (?,?,?,0,1)`,
      [nombre, moneda||'ARS', responsable||'']
    );
    return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
