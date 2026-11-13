import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

// Obtiene o crea el proveedor especial INTERNO usado por NDIs
async function getInternoProveedorId(): Promise<number> {
  const existing = await db.get(
    `SELECT id FROM proveedores WHERE cuit = '00000000000' AND activo = 1 LIMIT 1`
  );
  if (existing) return Number(existing.id);
  const result = await db.run(
    `INSERT INTO proveedores (razon_social, cuit, nombre_en_cxp, categoria, condicion_iva, activo)
     VALUES ('INTERNO', '00000000000', 'INTERNO', 'Interno', 'Exento', 1)`
  );
  return Number(result.lastInsertRowid);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { fecha_emision, fecha_vencimiento, importe, motivo_interna, numero } = await req.json();
    if (!fecha_emision || !fecha_vencimiento || !importe) {
      return NextResponse.json({ error: "Fecha, vencimiento e importe son requeridos" }, { status: 400 });
    }
    const proveedorId = await getInternoProveedorId();
    const nroFinal = numero || `NDI-${Date.now()}`;
    const result = await db.run(
      `INSERT INTO facturas_recibidas
         (proveedor_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento,
          importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado,
          es_interna, motivo_interna)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        proveedorId, 'Nota de Débito Interna', nroFinal,
        fecha_emision, fecha_vencimiento,
        parseFloat(importe) || 0, 'exento', 0, parseFloat(importe) || 0,
        motivo_interna || '', 'pendiente_pago',
        1, motivo_interna || '',
      ]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (err) {
    console.error('NDI error:', err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
