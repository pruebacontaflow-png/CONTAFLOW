import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const factura_id = searchParams.get("factura_id") || "";
    let sql = `SELECT g.*, fe.numero as factura_numero, fe.importe_total as factura_importe,
                      c.razon_social as cliente_nombre
               FROM gestiones_cobranza g
               LEFT JOIN facturas_emitidas fe ON fe.id = g.factura_id
               LEFT JOIN clientes c ON c.id = fe.cliente_id
               WHERE 1=1`;
    const args: any[] = [];
    if (factura_id) { sql += ` AND g.factura_id = ?`; args.push(factura_id); }
    sql += ` ORDER BY g.fecha DESC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { factura_id, fecha, tipo, resultado, notas, proxima_accion, fecha_proxima } = await req.json();
    if (!factura_id || !fecha || !tipo || !notas) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const user = (session.user as any)?.name || "";
    const result = await db.run(
      `INSERT INTO gestiones_cobranza (factura_id, fecha, tipo, resultado, notas, proxima_accion, fecha_proxima, usuario)
       VALUES (?,?,?,?,?,?,?,?)`,
      [factura_id, fecha, tipo, resultado || "", notas, proxima_accion || "", fecha_proxima || null, user]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
