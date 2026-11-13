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
    const soloNoAprobados = searchParams.get("soloNoAprobados") === "1";
    let sql = `SELECT * FROM viaticos WHERE (empleado LIKE ? OR descripcion LIKE ? OR destino LIKE ?)`;
    const args: any[] = [`%${search}%`, `%${search}%`, `%${search}%`];
    if (soloNoAprobados) { sql += ` AND aprobado = 0`; }
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
    const { empleado, fecha, tipo, destino, importe, moneda, descripcion } = await req.json();
    if (!empleado || !fecha || !tipo || !importe) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO viaticos (empleado, fecha, tipo, destino, importe, moneda, descripcion) VALUES (?,?,?,?,?,?,?)`,
      [empleado, fecha, tipo, destino || "", importe, moneda || "ARS", descripcion || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
