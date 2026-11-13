import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const rows = await db.all(`SELECT * FROM retenciones_config ORDER BY tipo, descripcion`);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const { tipo, descripcion, codigo_regimen = "", alicuota, minimo_no_imponible = 0, acumula_mensual = 1 } = body;
  if (!tipo || !descripcion || alicuota == null) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }
  const r = await db.run(
    `INSERT INTO retenciones_config (tipo,descripcion,codigo_regimen,alicuota,minimo_no_imponible,acumula_mensual)
     VALUES (?,?,?,?,?,?)`,
    [tipo, descripcion, codigo_regimen, Number(alicuota), Number(minimo_no_imponible), acumula_mensual ? 1 : 0]
  );
  return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
}
