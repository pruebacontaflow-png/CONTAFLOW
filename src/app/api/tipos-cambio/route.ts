import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const moneda = searchParams.get("moneda") || "";
    let sql = `SELECT * FROM tipos_cambio`;
    const args: any[] = [];
    if (moneda) { sql += ` WHERE moneda = ?`; args.push(moneda); }
    sql += ` ORDER BY fecha DESC, moneda ASC LIMIT 200`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { fecha, moneda, compra, venta, fuente } = await req.json();
    if (!fecha || !moneda) {
      return NextResponse.json({ error: "Fecha y moneda son requeridos" }, { status: 400 });
    }
    const result = await db.run(
      `INSERT INTO tipos_cambio (fecha, moneda, compra, venta, fuente) VALUES (?,?,?,?,?)`,
      [fecha, moneda, compra || 0, venta || 0, fuente || "Manual"]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
