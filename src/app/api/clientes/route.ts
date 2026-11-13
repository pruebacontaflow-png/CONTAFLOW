import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const clientes = await db.all(
      `SELECT c.*, COUNT(CASE WHEN fe.estado = 'cobro_pendiente' THEN 1 END) as cobros_pendientes,
       COUNT(fe.id) as total_facturas,
       COALESCE(SUM(CASE WHEN fe.estado IN ('cobro_pendiente','vencida') THEN fe.importe_total ELSE 0 END), 0) as deuda_total
       FROM clientes c LEFT JOIN facturas_emitidas fe ON fe.cliente_id = c.id
       WHERE c.activo = 1 AND (c.razon_social LIKE ? OR c.cuit LIKE ?)
       GROUP BY c.id ORDER BY c.razon_social ASC`,
      [`%${search}%`, `%${search}%`]
    );
    return NextResponse.json(clientes);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { razon_social, cuit, categoria, email, condicion_iva } = await req.json();
    if (!razon_social || !cuit) return NextResponse.json({ error: 'Razón social y CUIT requeridos' }, { status: 400 });
    const result = await db.run(
      `INSERT INTO clientes (razon_social, cuit, categoria, email, condicion_iva) VALUES (?, ?, ?, ?, ?)`,
      [razon_social, cuit, categoria||'', email||'', condicion_iva||'Responsable Inscripto']
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return NextResponse.json({ error: 'CUIT ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
