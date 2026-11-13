import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; lineaId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const { categoria, cuenta_contable_id, conciliado, referencia_tipo, referencia_id, observaciones } = body;

  const linea = await db.get(`SELECT * FROM extractos_lineas WHERE id=? AND extracto_id=?`, [params.lineaId, params.id]);
  if (!linea) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.run(
    `UPDATE extractos_lineas SET
       categoria=COALESCE(?,categoria),
       cuenta_contable_id=COALESCE(?,cuenta_contable_id),
       conciliado=COALESCE(?,conciliado),
       referencia_tipo=COALESCE(?,referencia_tipo),
       referencia_id=COALESCE(?,referencia_id),
       observaciones=COALESCE(?,observaciones)
     WHERE id=?`,
    [
      categoria !== undefined ? categoria : null,
      cuenta_contable_id !== undefined ? cuenta_contable_id : null,
      conciliado !== undefined ? (conciliado ? 1 : 0) : null,
      referencia_tipo !== undefined ? referencia_tipo : null,
      referencia_id !== undefined ? referencia_id : null,
      observaciones !== undefined ? observaciones : null,
      params.lineaId,
    ]
  );
  return NextResponse.json({ ok: true });
}
