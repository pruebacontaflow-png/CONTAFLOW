// GET — datos del proveedor del usuario logueado (solo nombre/razón social)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "proveedor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const proveedor_id = (session.user as any).proveedor_id;
  if (!proveedor_id) return NextResponse.json({ error: "Sin proveedor asignado" }, { status: 400 });

  const proveedor = await db.get(
    `SELECT id, razon_social, cuit, condicion_iva FROM proveedores WHERE id = ?`,
    [proveedor_id]
  );
  return NextResponse.json(proveedor);
}
