import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") || "pendientes"; // pendientes|completados|rechazados
    const search = searchParams.get("search") || "";
    const hoy = new Date().toISOString().split("T")[0];

    let estadoWhere = "";
    if (tab === "pendientes") estadoWhere = `lp.estado IN ('borrador', 'pendiente')`;
    else if (tab === "completados") estadoWhere = `lp.estado IN ('aprobado', 'ejecutado')`;
    else if (tab === "rechazados") estadoWhere = `lp.estado = 'cancelado'`;

    const sql = `
      SELECT
        lp.*,
        COUNT(lpi.id) as cant_items,
        COALESCE(SUM(lpi.importe), 0) as total_items,
        GROUP_CONCAT(DISTINCT COALESCE(p.razon_social, '')) as proveedores_str,
        MAX(CASE WHEN fr.fecha_vencimiento < ? THEN
          CAST(julianday(?) - julianday(fr.fecha_vencimiento) AS INTEGER)
          ELSE 0 END) as dias_max_vencida
      FROM lotes_pago lp
      LEFT JOIN lotes_pago_items lpi ON lpi.lote_id = lp.id
      LEFT JOIN facturas_recibidas fr ON fr.id = lpi.factura_id
      LEFT JOIN proveedores p ON p.id = fr.proveedor_id
      ${estadoWhere ? `WHERE ${estadoWhere}` : ""}
      GROUP BY lp.id
      ORDER BY lp.fecha DESC
    `;
    let rows = await db.all(sql, [hoy, hoy]);

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        String(r.nombre || "").toLowerCase().includes(q) ||
        String(r.proveedores_str || "").toLowerCase().includes(q) ||
        String(r.creado_por || "").toLowerCase().includes(q) ||
        String(r.total || "").includes(q)
      );
    }

    return NextResponse.json(rows);
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
    const { nombre, fecha, items } = await req.json();
    if (!nombre || !fecha) {
      return NextResponse.json({ error: "Nombre y fecha son requeridos" }, { status: 400 });
    }
    const total = (items || []).reduce((acc: number, i: any) => acc + (parseFloat(i.importe) || 0), 0);
    const loteResult = await db.run(
      `INSERT INTO lotes_pago (nombre, fecha, estado, creado_por, total) VALUES (?,?,?,?,?)`,
      [nombre, fecha, 'borrador', (session.user as any).email || '', total]
    );
    const loteId = Number(loteResult.lastInsertRowid);
    for (const item of (items || [])) {
      await db.run(
        `INSERT INTO lotes_pago_items (lote_id, factura_id, importe, descripcion) VALUES (?,?,?,?)`,
        [loteId, item.factura_id || null, parseFloat(item.importe) || 0, item.descripcion || '']
      );
    }
    return NextResponse.json({ id: String(loteId) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
