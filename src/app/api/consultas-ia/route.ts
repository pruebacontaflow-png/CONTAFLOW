import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const consultas = await db.all(`SELECT * FROM consultas_guardadas WHERE activa=1 ORDER BY id ASC`);
    return NextResponse.json(consultas);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { consulta_id } = await req.json();
    if (!consulta_id) return NextResponse.json({ error: "consulta_id requerido" }, { status: 400 });
    const consulta = await db.get(`SELECT * FROM consultas_guardadas WHERE id=? AND activa=1`, [consulta_id]);
    if (!consulta) return NextResponse.json({ error: "Consulta no encontrada" }, { status: 404 });
    // Ejecuta la query guardada de forma segura (solo lectura)
    const sql = String(consulta.sql_query);
    if (/\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|PRAGMA)\b/i.test(sql))
      return NextResponse.json({ error: "Consulta no permitida" }, { status: 403 });
    const rows = await db.all(sql, []);
    return NextResponse.json({ consulta, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error al ejecutar consulta" }, { status: 500 });
  }
}
