import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const rows = await db.all(
      `SELECT i.*,
       COALESCE(SUM(CASE WHEN m.tipo='deposito' THEN m.importe ELSE -m.importe END), 0) as saldo_calculado
       FROM inversiones i
       LEFT JOIN inversion_movimientos m ON m.inversion_id = i.id
       GROUP BY i.id ORDER BY i.nombre ASC`
    );
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { nombre, tipo, entidad, moneda, tasa_nominal, fecha_inicio, fecha_vencimiento, observaciones } = body;
    if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
    const r = await db.run(
      `INSERT INTO inversiones (nombre,tipo,entidad,moneda,saldo_actual,tasa_nominal,fecha_inicio,fecha_vencimiento,estado,observaciones) VALUES (?,?,?,?,0,?,?,?,'activa',?)`,
      [nombre, tipo||'plazo_fijo', entidad||'', moneda||'ARS', tasa_nominal||0, fecha_inicio||'', fecha_vencimiento||'', observaciones||'']
    );
    return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
