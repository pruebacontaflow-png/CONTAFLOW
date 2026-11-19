import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const soloSinOp = searchParams.get("soloSinOp") === "1";

  // Traer todos los viáticos con su posible OP asociada
  let sql = `
    SELECT v.*,
           op.numero AS op_numero,
           op.estado AS op_estado
    FROM viaticos v
    LEFT JOIN ordenes_pago op ON op.id = v.op_rendicion_id
    WHERE (v.empleado LIKE ? OR v.descripcion LIKE ? OR v.archivo_adjunto LIKE ?)
  `;
  const args: any[] = [`%${search}%`, `%${search}%`, `%${search}%`];
  if (soloSinOp) { sql += ` AND v.op_rendicion_id IS NULL`; }
  sql += ` ORDER BY v.fecha_rendicion DESC, v.fecha DESC`;

  const rows: any[] = await db.all(sql, args);

  // Agrupar por archivo_adjunto (clave de la rendición)
  const grupos = new Map<string, any>();
  for (const row of rows) {
    const clave = row.archivo_adjunto || `sin-archivo-${row.id}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        empleado: row.empleado,
        fecha_rendicion: row.fecha_rendicion,
        archivo_adjunto: row.archivo_adjunto,
        archivo_nombre: row.archivo_adjunto ? String(row.archivo_adjunto).split(/[/\\]/).pop() : "",
        total_rendicion: row.total_rendicion,
        medio_pago: row.medio_pago,
        op_rendicion_id: row.op_rendicion_id,
        op_numero: row.op_numero,
        op_estado: row.op_estado,
        area: row.area,
        observacion: row.observacion,
        aprobados: 0,
        total: 0,
        items: [],
      });
    }
    const g = grupos.get(clave)!;
    if (row.aprobado) g.aprobados++;
    g.total += Number(row.importe) || 0;
    g.items.push(row);
  }

  return NextResponse.json(Array.from(grupos.values()));
}
