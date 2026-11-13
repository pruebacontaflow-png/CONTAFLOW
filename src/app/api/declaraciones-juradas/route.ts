import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get("tipo") || "";
    const estado = searchParams.get("estado") || "";
    let sql = `SELECT * FROM declaraciones_juradas WHERE 1=1`;
    const args: any[] = [];
    if (tipo)   { sql += ` AND tipo = ?`;   args.push(tipo); }
    if (estado) { sql += ` AND estado = ?`; args.push(estado); }
    sql += ` ORDER BY tipo ASC, COALESCE(NULLIF(periodo,''), substr(fecha_pago,1,7)) ASC, fecha_pago ASC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { tipo, periodo, vep, monto, fecha_pago, notas } = await req.json();
    if (!tipo || !periodo) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO declaraciones_juradas (tipo, periodo, vep, monto, fecha_pago, notas) VALUES (?,?,?,?,?,?)`,
      [tipo, periodo, vep || "", monto || 0, fecha_pago || null, notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
