import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const rows = await db.all(
      `SELECT ci.*,
        (SELECT COUNT(*) FROM cheques_emitidos ce WHERE ce.intervalo_id = ci.id) as cheques_usados
       FROM chequera_intervalos ci
       WHERE ci.chequera_id = ?
       ORDER BY ci.numero_remesa ASC, ci.numero_desde ASC`,
      [params.id]
    );
    return NextResponse.json(rows);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { numero_remesa, numero_desde, numero_hasta, info_breve, fecha_compra, no_secuencial } = await req.json();
    if (!numero_desde || !numero_hasta) {
      return NextResponse.json({ error: "N° cheque inicial y final son requeridos" }, { status: 400 });
    }
    const result = await db.run(
      `INSERT INTO chequera_intervalos (chequera_id, numero_remesa, numero_desde, numero_hasta, info_breve, fecha_compra, no_secuencial)
       VALUES (?,?,?,?,?,?,?)`,
      [params.id, numero_remesa || 1, numero_desde, numero_hasta, info_breve || "", fecha_compra || "", no_secuencial ? 1 : 0]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
