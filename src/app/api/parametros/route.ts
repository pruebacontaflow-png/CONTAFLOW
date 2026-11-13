import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const rows = await db.all(`SELECT * FROM parametros ORDER BY clave`);
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { clave, valor } = await req.json();
  await db.run(`UPDATE parametros SET valor=? WHERE clave=?`, [valor, clave]);
  return NextResponse.json({ ok: true });
}
