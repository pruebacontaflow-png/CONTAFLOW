import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const proveedor = await db.get(`SELECT * FROM proveedores WHERE id = ?`, [params.id]);
    if (!proveedor) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    const facturas = await db.all(`SELECT * FROM facturas_recibidas WHERE proveedor_id = ? ORDER BY fecha_emision DESC`, [params.id]);
    return NextResponse.json({ proveedor, facturas });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { razon_social, cuit, categoria, email, telefono, condicion_iva } = await req.json();
    await db.run(
      `UPDATE proveedores SET razon_social=?, cuit=?, categoria=?, email=?, telefono=?, condicion_iva=? WHERE id=?`,
      [razon_social, cuit, categoria||'', email||'', telefono||'', condicion_iva||'Responsable Inscripto', params.id]
    );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return NextResponse.json({ error: 'El CUIT ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await db.run(`UPDATE proveedores SET activo = 0 WHERE id = ?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
