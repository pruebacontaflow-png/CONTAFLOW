import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const tipo = searchParams.get("tipo") || "";
    const q = `%${search}%`;
    let sql = `SELECT * FROM minutas WHERE (titulo LIKE ? OR participantes LIKE ? OR resoluciones LIKE ?)`;
    const args: any[] = [q, q, q];
    if (tipo) { sql += ` AND tipo = ?`; args.push(tipo); }
    sql += ` ORDER BY fecha DESC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { fecha, tipo, titulo, lugar, participantes, descripcion, resoluciones, proximas_acciones, responsable } = await req.json();
    if (!fecha || !titulo) return NextResponse.json({ error: "Fecha y título son requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO minutas (fecha, tipo, titulo, lugar, participantes, descripcion, resoluciones, proximas_acciones, responsable)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [fecha, tipo || "reunion", titulo, lugar || "", participantes || "", descripcion || "", resoluciones || "", proximas_acciones || "", responsable || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
