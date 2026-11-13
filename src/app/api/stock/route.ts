import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const productos = await db.all(
      `SELECT p.*, COUNT(m.id) as total_movimientos FROM productos p LEFT JOIN stock_movimientos m ON m.producto_id = p.id WHERE p.activo=1 GROUP BY p.id ORDER BY p.nombre`
    );
    return NextResponse.json(productos);
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { codigo, nombre, unidad, stock_minimo, observaciones } = await req.json();
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const r = await db.run(
      `INSERT INTO productos (codigo,nombre,unidad,stock_actual,stock_minimo,observaciones) VALUES (?,?,?,0,?,?)`,
      [codigo||null, nombre, unidad||'unidad', stock_minimo||0, observaciones||'']
    );
    return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return NextResponse.json({ error: 'Código ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
