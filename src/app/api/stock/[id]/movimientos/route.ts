import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const rows = await db.all(
      `SELECT * FROM stock_movimientos WHERE producto_id=? ORDER BY fecha DESC, id DESC`,
      [params.id]
    );
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { fecha, tipo, cantidad, destino, observaciones } = await req.json();
    if (!fecha || !cantidad) return NextResponse.json({ error: 'Fecha y cantidad requeridas' }, { status: 400 });

    const prod = await db.get(`SELECT stock_actual FROM productos WHERE id=?`, [params.id]);
    if (!prod) return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });

    const delta = tipo === 'ingreso' ? Number(cantidad) : -Number(cantidad);
    const nuevo_stock = (prod.stock_actual as number) + delta;

    await db.run(
      `INSERT INTO stock_movimientos (producto_id,fecha,tipo,cantidad,stock_resultante,destino,observaciones) VALUES (?,?,?,?,?,?,?)`,
      [params.id, fecha, tipo||'egreso', cantidad, nuevo_stock, destino||'', observaciones||'']
    );
    await db.run(`UPDATE productos SET stock_actual=? WHERE id=?`, [nuevo_stock, params.id]);

    return NextResponse.json({ stock_actual: nuevo_stock }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
