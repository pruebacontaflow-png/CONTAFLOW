/**
 * POST /api/extractos/[id]/aplicar-reglas
 * Re-aplica todas las reglas de clasificación activas a las líneas no conciliadas del extracto.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const lineas = await db.all(
    `SELECT * FROM extractos_lineas WHERE extracto_id=? AND conciliado=0`,
    [params.id]
  );
  const reglas = await db.all(`SELECT * FROM reglas_clasificacion WHERE activo=1 ORDER BY prioridad DESC`);

  let aplicadas = 0;

  for (const linea of lineas) {
    for (const regla of reglas) {
      const desc = String(linea.descripcion).toLowerCase();
      const pat  = String(regla.patron).toLowerCase();
      let match = false;
      if (regla.tipo_match === "contiene") match = desc.includes(pat);
      else if (regla.tipo_match === "empieza") match = desc.startsWith(pat);
      else if (regla.tipo_match === "termina") match = desc.endsWith(pat);
      else if (regla.tipo_match === "exacto")  match = desc === pat;

      if (match) {
        await db.run(
          `UPDATE extractos_lineas SET categoria=?, cuenta_contable_id=? WHERE id=?`,
          [regla.categoria || "", regla.cuenta_contable_id ?? null, linea.id]
        );
        aplicadas++;
        break;
      }
    }
  }

  return NextResponse.json({ aplicadas, total: lineas.length });
}
