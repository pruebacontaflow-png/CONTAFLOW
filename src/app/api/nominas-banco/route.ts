import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    return NextResponse.json(await db.all(`SELECT * FROM nominas_banco ORDER BY fecha DESC`));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { banco, fecha, total, empleados, notas } = await req.json();
    if (!banco || !fecha) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO nominas_banco (banco, fecha, total, empleados, notas) VALUES (?,?,?,?,?)`,
      [banco, fecha, total || 0, empleados || 0, notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
