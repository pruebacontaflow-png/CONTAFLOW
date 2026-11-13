import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  // Auto-crear períodos de los últimos 12 meses si no existen
  const hoy = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    await db.run(
      `INSERT OR IGNORE INTO periodos_contables (anio,mes) VALUES (?,?)`,
      [d.getFullYear(), d.getMonth() + 1]
    );
  }
  const rows = await db.all(
    `SELECT p.*,
       (SELECT COUNT(*) FROM asientos WHERE anio=p.anio AND mes=p.mes) as cant_asientos,
       (SELECT COUNT(*) FROM facturas_recibidas
        WHERE strftime('%Y'||'-'||printf('%02d',cast(strftime('%m',fecha_emision) as int)), fecha_emision)
              = printf('%04d-%02d', p.anio, p.mes)
          AND estado NOT IN ('rechazada','pendiente_revision','requiere_revision')
       ) as cant_facturas_compras
     FROM periodos_contables p
     ORDER BY p.anio DESC, p.mes DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { anio, mes } = await req.json();
  await db.run(`INSERT OR IGNORE INTO periodos_contables (anio,mes) VALUES (?,?)`, [anio, mes]);
  return NextResponse.json({ ok: true }, { status: 201 });
}
