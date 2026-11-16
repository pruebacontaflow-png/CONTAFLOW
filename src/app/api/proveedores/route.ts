import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const anio = searchParams.get('anio') || new Date().getFullYear().toString();

    const proveedores = await db.all(
      `SELECT p.*,
       COUNT(CASE WHEN fr.estado = 'pendiente_pago' THEN 1 END) as facturas_pendientes,
       COUNT(fr.id) as total_facturas,
       COALESCE(SUM(CASE WHEN fr.estado = 'pendiente_pago' THEN fr.importe_total ELSE 0 END), 0) as deuda_total,
       pc.nombre as cuenta_contable_nombre,
       pdc.link as drive_carpeta_anio
       FROM proveedores p
       LEFT JOIN facturas_recibidas fr ON fr.proveedor_id = p.id
       LEFT JOIN plan_cuentas pc ON pc.id = p.cuenta_contable_id
       LEFT JOIN proveedor_drive_carpetas pdc ON pdc.proveedor_id = p.id AND pdc.anio = ?
       WHERE p.activo = 1 AND (p.razon_social LIKE ? OR p.cuit LIKE ? OR p.categoria LIKE ? OR p.codigo_proveedor LIKE ? OR p.servicio LIKE ?)
       GROUP BY p.id ORDER BY p.razon_social ASC`,
      [anio, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]
    );
    return NextResponse.json(proveedores);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { razon_social, cuit, categoria, email, telefono, condicion_iva } = await req.json();
    if (!razon_social || !cuit) return NextResponse.json({ error: 'Razón social y CUIT son requeridos' }, { status: 400 });

    const result = await db.run(
      `INSERT INTO proveedores (razon_social, cuit, categoria, email, telefono, condicion_iva) VALUES (?, ?, ?, ?, ?, ?)`,
      [razon_social, cuit, categoria || '', email || '', telefono || '', condicion_iva || 'Responsable Inscripto']
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) return NextResponse.json({ error: 'El CUIT ya existe' }, { status: 409 });
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
