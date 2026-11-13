import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { checkPeriodoCerrado } from "@/lib/periodos";
import { asientoCompra } from "@/lib/asientos-auto";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const search      = searchParams.get("search")      || "";
    const estado      = searchParams.get("estado")      || "";
    const proveedor_id = searchParams.get("proveedor_id") || "";

    let sql = `SELECT fr.*, COALESCE(p.razon_social, 'INTERNO') as proveedor_nombre, p.cuit as proveedor_cuit
               FROM facturas_recibidas fr LEFT JOIN proveedores p ON p.id = fr.proveedor_id
               WHERE (COALESCE(p.razon_social,'') LIKE ? OR fr.numero LIKE ? OR fr.concepto LIKE ?)`;
    const args: any[] = [`%${search}%`, `%${search}%`, `%${search}%`];

    if (estado)       { sql += ` AND fr.estado = ?`;        args.push(estado); }
    if (proveedor_id) { sql += ` AND fr.proveedor_id = ?`;  args.push(proveedor_id); }
    sql += ` ORDER BY fr.fecha_emision DESC`;

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
      proveedor_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento,
      importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado,
      neto_gravado, neto_no_gravado, exento, percepcion_iva, percepcion_iibb,
    } = body;

    if (!proveedor_id || !numero || !fecha_emision || !fecha_vencimiento) {
      return NextResponse.json({ error: "Campos requeridos faltantes" }, { status: 400 });
    }

    // Verificar período
    const estadoFinal = estado || "pendiente_pago";
    const err = await checkPeriodoCerrado(fecha_emision);
    if (err) return NextResponse.json({ error: err }, { status: 422 });

    const result = await db.run(
      `INSERT INTO facturas_recibidas
         (proveedor_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento,
          importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado,
          neto_gravado, neto_no_gravado, exento, percepcion_iva, percepcion_iibb)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        proveedor_id, tipo_comprobante || "A", numero, fecha_emision, fecha_vencimiento,
        importe_neto || 0, tipo_iva || "21%", importe_iva || 0, importe_total || 0,
        concepto || "", estadoFinal,
        neto_gravado || 0, neto_no_gravado || 0, exento || 0, percepcion_iva || 0, percepcion_iibb || 0,
      ]
    );
    const facturaId = Number(result.lastInsertRowid);

    // Asiento automático si se carga directo en pendiente_pago
    if (estadoFinal === "pendiente_pago") {
      asientoCompra(facturaId).catch(e => console.warn("asientoCompra:", e));
    }

    return NextResponse.json({ id: String(facturaId) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
