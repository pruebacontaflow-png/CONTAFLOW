import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const tarjeta_id = searchParams.get("tarjeta_id") || "";
    const search = searchParams.get("search") || "";
    let sql = `SELECT gt.*, tc.banco, tc.numero_ultimos4, tc.titular
               FROM gastos_tarjeta gt
               JOIN tarjetas_corporativas tc ON tc.id = gt.tarjeta_id
               WHERE (gt.comercio LIKE ? OR gt.descripcion LIKE ?)`;
    const args: any[] = [`%${search}%`, `%${search}%`];
    if (tarjeta_id) { sql += ` AND gt.tarjeta_id = ?`; args.push(tarjeta_id); }
    sql += ` ORDER BY gt.fecha DESC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { tarjeta_id, fecha, comercio, importe, moneda, factura_id, descripcion } = await req.json();
    if (!tarjeta_id || !fecha || !comercio || !importe) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO gastos_tarjeta (tarjeta_id, fecha, comercio, importe, moneda, factura_id, descripcion) VALUES (?,?,?,?,?,?,?)`,
      [tarjeta_id, fecha, comercio, importe, moneda || "ARS", factura_id || null, descripcion || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
