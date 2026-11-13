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
    const estado = searchParams.get("estado") || "";
    let sql = `SELECT ch.*, op.numero as op_numero FROM cheques ch LEFT JOIN ordenes_pago op ON op.id = ch.orden_pago_id WHERE (ch.beneficiario LIKE ? OR ch.numero LIKE ? OR ch.banco LIKE ?)`;
    const args: any[] = [`%${search}%`, `%${search}%`, `%${search}%`];
    if (estado) { sql += ` AND ch.estado = ?`; args.push(estado); }
    sql += ` ORDER BY ch.fecha_emision DESC`;
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
    const { banco, numero, fecha_emision, fecha_cobro, beneficiario, importe, estado, orden_pago_id, moneda, notas } = await req.json();
    if (!banco || !numero || !fecha_emision || !beneficiario || !importe) {
      return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    }
    const result = await db.run(
      `INSERT INTO cheques (banco, numero, fecha_emision, fecha_cobro, beneficiario, importe, estado, orden_pago_id, moneda, notas) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [banco, numero, fecha_emision, fecha_cobro || null, beneficiario, importe, estado || "en_cartera", orden_pago_id || null, moneda || "ARS", notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
