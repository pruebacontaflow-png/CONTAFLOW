import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    // Get all intervals sorted by numero_desde
    const intervalos = await db.all(
      `SELECT * FROM chequera_intervalos WHERE chequera_id = ? ORDER BY numero_desde ASC`,
      [params.id]
    );
    if (!intervalos.length) return NextResponse.json({ numero: null, mensaje: "Sin intervalos" });

    for (const intervalo of intervalos) {
      const desde = parseInt(intervalo.numero_desde as string, 10);
      const hasta = parseInt(intervalo.numero_hasta as string, 10);

      // Get used numbers in this interval
      const usados = await db.all(
        `SELECT numero FROM cheques_emitidos WHERE intervalo_id = ? AND estado != 'anulado'`,
        [intervalo.id]
      );
      const usadosSet = new Set(usados.map(u => parseInt(u.numero as string, 10)));

      // Find first free number
      for (let n = desde; n <= hasta; n++) {
        if (!usadosSet.has(n)) {
          const padLen = (intervalo.numero_desde as string).length;
          return NextResponse.json({
            numero: String(n).padStart(padLen, "0"),
            intervalo_id: intervalo.id,
            numero_remesa: intervalo.numero_remesa,
          });
        }
      }
    }

    return NextResponse.json({ numero: null, mensaje: "Todos los cheques de los intervalos están utilizados" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
