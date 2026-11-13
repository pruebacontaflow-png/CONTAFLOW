import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const lote = await db.get(`SELECT * FROM lotes_pago WHERE id = ?`, [params.id]);
    if (!lote) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const items = await db.all(
      `SELECT lpi.*, COALESCE(fr.numero, '') as numero, COALESCE(fr.tipo_comprobante, lpi.comprobante) as tipo_comprobante, COALESCE(p.razon_social, lpi.proveedor) as proveedor
       FROM lotes_pago_items lpi
       LEFT JOIN facturas_recibidas fr ON fr.id = lpi.factura_id
       LEFT JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE lpi.lote_id = ?`,
      [params.id]
    );
    return NextResponse.json({ ...lote, items });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { estado } = await req.json();
    await db.run(`UPDATE lotes_pago SET estado = ? WHERE id = ?`, [estado, params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    await db.run(`DELETE FROM lotes_pago_items WHERE lote_id = ?`, [params.id]);
    await db.run(`DELETE FROM lotes_pago WHERE id = ?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
