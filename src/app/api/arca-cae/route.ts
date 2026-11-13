import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const pv = searchParams.get("punto_venta") || "";
    const estado = searchParams.get("estado") || "";
    let sql = `SELECT * FROM arca_lotes_cae WHERE 1=1`;
    const args: any[] = [];
    if (pv)     { sql += ` AND punto_venta = ?`; args.push(parseInt(pv)); }
    if (estado) { sql += ` AND estado = ?`;      args.push(estado); }
    sql += ` ORDER BY fecha_solicitud DESC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { fecha_solicitud, punto_venta, tipo_comprobante, numero_desde, numero_hasta, cae, vencimiento_cae, notas } = await req.json();
    if (!fecha_solicitud || !punto_venta || !cae || !vencimiento_cae)
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const cantidad = (parseInt(numero_hasta) || 0) - (parseInt(numero_desde) || 0) + 1;
    const result = await db.run(
      `INSERT INTO arca_lotes_cae (fecha_solicitud, punto_venta, tipo_comprobante, numero_desde, numero_hasta, cae, vencimiento_cae, cantidad, notas)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [fecha_solicitud, parseInt(punto_venta), tipo_comprobante || "", parseInt(numero_desde) || 0, parseInt(numero_hasta) || 0, cae, vencimiento_cae, cantidad, notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
