import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    return NextResponse.json(await db.all(`SELECT * FROM tarjetas_corporativas ORDER BY banco, numero_ultimos4`));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { banco, numero_ultimos4, titular, limite, moneda } = await req.json();
    if (!banco || !numero_ultimos4 || !titular) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO tarjetas_corporativas (banco, numero_ultimos4, titular, limite, moneda) VALUES (?,?,?,?,?)`,
      [banco, numero_ultimos4, titular, limite || 0, moneda || "ARS"]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
