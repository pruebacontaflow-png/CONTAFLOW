import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const rows = await db.all(`SELECT * FROM plan_cuentas ORDER BY codigo`);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { codigo, nombre, tipo, subtipo, parent_id, imputable } = await req.json();
  if (!codigo || !nombre || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  const r = await db.run(
    `INSERT INTO plan_cuentas (codigo,nombre,tipo,subtipo,parent_id,imputable) VALUES (?,?,?,?,?,?)`,
    [codigo, nombre, tipo, subtipo || "", parent_id || null, imputable ? 1 : 0]
  );
  return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
}
