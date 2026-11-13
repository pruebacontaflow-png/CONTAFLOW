import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { checkPeriodoCerrado } from "@/lib/periodos";
import { asientoVenta } from "@/lib/asientos-auto";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const estado = searchParams.get("estado") || "";

    let sql = `SELECT fe.*, c.razon_social as cliente_nombre, c.cuit as cliente_cuit
               FROM facturas_emitidas fe JOIN clientes c ON c.id = fe.cliente_id
               WHERE (c.razon_social LIKE ? OR fe.numero LIKE ? OR fe.concepto LIKE ?)`;
    const args: any[] = [`%${search}%`, `%${search}%`, `%${search}%`];

    if (estado) { sql += ` AND fe.estado = ?`; args.push(estado); }
    sql += ` ORDER BY fe.fecha_emision DESC`;

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
    const body = await req.json();
    const {
      cliente_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento,
      importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado,
    } = body;

    if (!cliente_id || !numero || !fecha_emision || !fecha_vencimiento) {
      return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    // Verificar período
    const err = await checkPeriodoCerrado(fecha_emision);
    if (err) return NextResponse.json({ error: err }, { status: 422 });

    const result = await db.run(
      `INSERT INTO facturas_emitidas (cliente_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento, importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [cliente_id, tipo_comprobante || "A", numero, fecha_emision, fecha_vencimiento,
       importe_neto || 0, tipo_iva || "21%", importe_iva || 0, importe_total || 0,
       concepto || "", estado || "cobro_pendiente"]
    );
    const facturaId = Number(result.lastInsertRowid);

    // Asiento automático de venta
    asientoVenta(facturaId).catch(e => console.warn("asientoVenta:", e));

    return NextResponse.json({ id: String(facturaId) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
