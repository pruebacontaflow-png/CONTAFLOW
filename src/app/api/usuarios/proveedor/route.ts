// GET /api/usuarios/proveedor?proveedor_id=X
// Devuelve el usuario vinculado a ese proveedor (si existe)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const proveedor_id = searchParams.get("proveedor_id");
  if (!proveedor_id) return NextResponse.json(null);

  const usuario = await db.get(
    `SELECT id, username, rol, activo, created_at FROM usuarios WHERE proveedor_id = ?`,
    [proveedor_id]
  );
  return NextResponse.json(usuario);
}
