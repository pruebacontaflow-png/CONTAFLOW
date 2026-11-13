import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET() {
  try {
    const rows = await db.all(
      `SELECT c.*, p.razon_social as proveedor_razon_social, p.cuit as proveedor_cuit
       FROM comerciales c
       LEFT JOIN proveedores p ON p.id = c.proveedor_id
       ORDER BY c.nombre ASC`
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, proveedor_id, zona } = await req.json();
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const r = await db.run(
      `INSERT INTO comerciales (nombre, proveedor_id, zona, activo) VALUES (?,?,?,1)`,
      [nombre, proveedor_id || null, zona || '']
    );
    return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
