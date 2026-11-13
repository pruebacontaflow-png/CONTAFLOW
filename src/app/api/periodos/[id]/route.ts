import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { accion } = await req.json(); // "cerrar" | "reabrir"
  if (accion !== "cerrar" && accion !== "reabrir") {
    return NextResponse.json({ error: "accion debe ser cerrar o reabrir" }, { status: 400 });
  }
  const periodo = await db.get(`SELECT * FROM periodos_contables WHERE id=?`, [params.id]);
  if (!periodo) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (accion === "cerrar") {
    // Verificar que asientos estén balanceados (suma global del período)
    const balance = await db.get(
      `SELECT SUM(al.debe) as total_debe, SUM(al.haber) as total_haber
       FROM asientos_lineas al
       JOIN asientos a ON a.id = al.asiento_id
       WHERE a.anio=? AND a.mes=?`,
      [periodo.anio, periodo.mes]
    );
    const debe  = Number(balance?.total_debe  ?? 0);
    const haber = Number(balance?.total_haber ?? 0);
    if (Math.abs(debe - haber) > 0.01) {
      return NextResponse.json({
        error: `El período no balancea: debe=${debe.toFixed(2)}, haber=${haber.toFixed(2)}`,
        debe, haber,
      }, { status: 400 });
    }
    const usuario = (session.user as any)?.name || (session.user as any)?.email || "admin";
    await db.run(
      `UPDATE periodos_contables SET cerrado=1, fecha_cierre=datetime('now'), cerrado_por=? WHERE id=?`,
      [usuario, params.id]
    );
  } else {
    await db.run(
      `UPDATE periodos_contables SET cerrado=0, fecha_cierre='', cerrado_por='' WHERE id=?`,
      [params.id]
    );
  }
  return NextResponse.json({ ok: true });
}
