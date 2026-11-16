import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const rows = await db.all(
      `SELECT m.*, c.nombre as caja_nombre, c.moneda
       FROM fondo_fijo_movimientos m
       LEFT JOIN fondo_fijo_cajas c ON c.id = m.caja_id
       WHERE m.caja_id=?
       ORDER BY m.fecha DESC, m.id DESC`,
      [params.id]
    );
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { fecha, tipo, importe, descripcion, proyecto, area, comprobante_numero, moneda } = await req.json();
    if (!fecha || !importe) return NextResponse.json({ error: 'Fecha e importe requeridos' }, { status: 400 });

    const caja = await db.get(`SELECT saldo_actual, moneda FROM fondo_fijo_cajas WHERE id=?`, [params.id]);
    if (!caja) return NextResponse.json({ error: 'Caja no encontrada' }, { status: 404 });

    const isIngreso = ['ingreso', 'reposicion'].includes(tipo);
    const delta = isIngreso ? Number(importe) : -Number(importe);
    const nuevo_saldo = (caja.saldo_actual as number) + delta;

    await db.run(
      `INSERT INTO fondo_fijo_movimientos (caja_id,fecha,tipo,importe,descripcion,proyecto,area,comprobante_numero,moneda,saldo_resultante) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [params.id, fecha, tipo||'egreso', importe, descripcion||'', proyecto||'', area||'', comprobante_numero||'', moneda||caja.moneda, nuevo_saldo]
    );
    await db.run(`UPDATE fondo_fijo_cajas SET saldo_actual=? WHERE id=?`, [nuevo_saldo, params.id]);

    return NextResponse.json({ saldo_actual: nuevo_saldo }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
