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
    let sql = `SELECT sr.*, p.razon_social as proveedor_nombre FROM servicios_recurrentes sr LEFT JOIN proveedores p ON p.id = sr.proveedor_id WHERE (sr.descripcion LIKE ? OR sr.cbu_debito LIKE ?)`;
    const args: any[] = [`%${search}%`, `%${search}%`];
    if (tipo) { sql += ` AND sr.tipo = ?`; args.push(tipo); }
    sql += ` ORDER BY sr.fecha_proximo_vto ASC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { descripcion, tipo, proveedor_id, monto, moneda, periodicidad, fecha_proximo_vto, cbu_debito, notas } = await req.json();
    if (!descripcion || !tipo) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO servicios_recurrentes (descripcion, tipo, proveedor_id, monto, moneda, periodicidad, fecha_proximo_vto, cbu_debito, notas) VALUES (?,?,?,?,?,?,?,?,?)`,
      [descripcion, tipo, proveedor_id || null, monto || 0, moneda || "ARS", periodicidad || "mensual", fecha_proximo_vto || null, cbu_debito || "", notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
