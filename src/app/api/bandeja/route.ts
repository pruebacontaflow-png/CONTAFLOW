/**
 * GET /api/bandeja?tipo=compra|venta
 * Lista comprobantes en estado pendiente_revision o requiere_revision.
 * Solo admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const tipo = req.nextUrl.searchParams.get("tipo") || "compra";

  if (tipo === "compra") {
    const rows = await db.all(
      `SELECT fr.*, p.razon_social as proveedor_nombre, p.cuit as proveedor_cuit
       FROM facturas_recibidas fr
       LEFT JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE fr.estado IN ('pendiente_revision', 'requiere_revision')
       ORDER BY fr.created_at ASC`,
      []
    );
    return NextResponse.json(rows);
  } else {
    const rows = await db.all(
      `SELECT fe.*, c.razon_social as cliente_nombre, c.cuit as cliente_cuit
       FROM facturas_emitidas fe
       LEFT JOIN clientes c ON c.id = fe.cliente_id
       WHERE fe.estado IN ('pendiente_revision', 'requiere_revision')
       ORDER BY fe.created_at ASC`,
      []
    );
    return NextResponse.json(rows);
  }
}
