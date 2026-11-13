import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const anio = searchParams.get("anio") || new Date().getFullYear().toString();
  const mes  = searchParams.get("mes")  || "";

  let sql = `SELECT a.*,
             COALESCE(SUM(al.debe),0)  as total_debe,
             COALESCE(SUM(al.haber),0) as total_haber
             FROM asientos a
             LEFT JOIN asientos_lineas al ON al.asiento_id = a.id
             WHERE a.anio = ?`;
  const args: any[] = [anio];
  if (mes) { sql += ` AND a.mes = ?`; args.push(mes); }
  sql += ` GROUP BY a.id ORDER BY a.fecha DESC, a.id DESC`;

  const rows = await db.all(sql, args);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { fecha, descripcion, lineas } = body;
  if (!fecha || !descripcion || !Array.isArray(lineas) || lineas.length < 2) {
    return NextResponse.json({ error: "Faltan campos o menos de 2 líneas" }, { status: 400 });
  }

  const d = new Date(fecha);
  const anio = d.getFullYear();
  const mes  = d.getMonth() + 1;

  // Verificar período no cerrado
  const periodo = await db.get(`SELECT cerrado FROM periodos_contables WHERE anio=? AND mes=?`, [anio, mes]);
  if (periodo?.cerrado) {
    return NextResponse.json({ error: `El período ${anio}/${mes} está cerrado` }, { status: 400 });
  }

  // Verificar partida doble
  const sumDebe  = lineas.reduce((s: number, l: any) => s + (Number(l.debe) || 0), 0);
  const sumHaber = lineas.reduce((s: number, l: any) => s + (Number(l.haber) || 0), 0);
  if (Math.abs(sumDebe - sumHaber) > 0.01) {
    return NextResponse.json({ error: `Asiento no balancea: debe=${sumDebe.toFixed(2)} haber=${sumHaber.toFixed(2)}` }, { status: 400 });
  }

  const r = await db.run(
    `INSERT INTO asientos (fecha,descripcion,tipo,anio,mes,estado) VALUES (?,?,'manual',?,?,'confirmado')`,
    [fecha, descripcion, anio, mes]
  );
  const asientoId = Number(r.lastInsertRowid);

  for (const l of lineas) {
    await db.run(
      `INSERT INTO asientos_lineas (asiento_id,cuenta_id,descripcion,debe,haber) VALUES (?,?,?,?,?)`,
      [asientoId, l.cuenta_id, l.descripcion || "", Number(l.debe) || 0, Number(l.haber) || 0]
    );
  }
  return NextResponse.json({ id: asientoId }, { status: 201 });
}
