import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { tipo, descripcion, codigo_regimen, alicuota, minimo_no_imponible, acumula_mensual, activo } = body;
  await db.run(
    `UPDATE retenciones_config SET tipo=?,descripcion=?,codigo_regimen=?,alicuota=?,
     minimo_no_imponible=?,acumula_mensual=?,activo=? WHERE id=?`,
    [tipo, descripcion, codigo_regimen ?? "", Number(alicuota), Number(minimo_no_imponible ?? 0),
     acumula_mensual ? 1 : 0, activo ? 1 : 0, params.id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // Baja lógica — no eliminar si tiene retenciones aplicadas
  const used = await db.get(`SELECT id FROM retenciones_aplicadas WHERE config_id=? LIMIT 1`, [params.id]);
  if (used) {
    await db.run(`UPDATE retenciones_config SET activo=0 WHERE id=?`, [params.id]);
  } else {
    await db.run(`DELETE FROM retenciones_config WHERE id=?`, [params.id]);
  }
  return NextResponse.json({ ok: true });
}
