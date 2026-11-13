import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const libro = sp.get("libro") || "compras";
  const estado = sp.get("estado") || "pendiente";
  const periodo = sp.get("periodo") || "2025";
  const rows = await db.all(
    `SELECT * FROM diferencias_arca WHERE libro = ? AND periodo = ? AND (? = 'todos' OR estado = ?) ORDER BY tipo_diferencia, contraparte, fecha`,
    [libro, periodo, estado, estado]);
  const resumen = await db.all(
    `SELECT libro, tipo_diferencia, estado, COUNT(*) as n, SUM(COALESCE(importe_arca, importe_sistema, 0)) as importe
     FROM diferencias_arca WHERE periodo = ? GROUP BY libro, tipo_diferencia, estado`, [periodo]);
  return NextResponse.json({ rows, resumen });
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id, estado, resolucion } = await req.json();
  if (!id || !["pendiente", "conciliado"].includes(estado)) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  await db.run(
    `UPDATE diferencias_arca SET estado = ?, resolucion = ?, resuelto_por = ?, resuelto_at = CASE WHEN ? = 'conciliado' THEN datetime('now','localtime') ELSE NULL END WHERE id = ?`,
    [estado, resolucion || "", (session.user as any).name || (session.user as any).email || "", estado, id]);
  return NextResponse.json({ ok: true });
}
