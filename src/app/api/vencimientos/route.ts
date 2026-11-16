import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const incluirPagados = searchParams.get('incluirPagados') === 'true';

    let queryFiscal = `SELECT id, descripcion, fecha_vencimiento, importe, estado, 'fiscal' as tipo FROM vencimientos_fiscales`;
    if (!incluirPagados) queryFiscal += ` WHERE estado = 'pendiente'`;
    queryFiscal += ` ORDER BY fecha_vencimiento ASC`;
    const fiscales = await db.all(queryFiscal);

    const facturasRecibidas = await db.all(
      `SELECT fr.id, p.razon_social as descripcion, fr.fecha_vencimiento, fr.importe_total as importe, fr.estado, 'factura_recibida' as tipo, fr.numero, fr.tipo_comprobante
       FROM facturas_recibidas fr JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE fr.estado = 'pendiente_pago' ORDER BY fr.fecha_vencimiento ASC`
    );

    const todos = [...fiscales, ...facturasRecibidas]
      .sort((a: any, b: any) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento)));

    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { descripcion, fecha_vencimiento, importe, estado } = await req.json();
    if (!descripcion || !fecha_vencimiento) return NextResponse.json({ error: 'Campos requeridos' }, { status: 400 });
    const result = await db.run(
      `INSERT INTO vencimientos_fiscales (descripcion, fecha_vencimiento, importe, estado) VALUES (?, ?, ?, ?)`,
      [descripcion, fecha_vencimiento, importe||0, estado||'pendiente']
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
