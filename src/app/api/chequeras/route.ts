import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const rows = await db.all(`
      SELECT ch.*, COUNT(ci.id) as cant_intervalos
      FROM chequeras ch
      LEFT JOIN chequera_intervalos ci ON ci.chequera_id = ch.id
      WHERE ch.activo = 1
      GROUP BY ch.id
      ORDER BY ch.banco, ch.id_cuenta
    `);
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { nombre, banco, id_cuenta, sociedad } = await req.json();
    if (!banco || !id_cuenta) {
      return NextResponse.json({ error: "Banco e ID de cuenta son requeridos" }, { status: 400 });
    }
    const result = await db.run(
      `INSERT INTO chequeras (nombre, banco, id_cuenta, sociedad) VALUES (?,?,?,?)`,
      [nombre || `${banco} - ${id_cuenta}`, banco, id_cuenta, sociedad || "IT Click Video"]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
