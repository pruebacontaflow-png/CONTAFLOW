import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const acuerdo_id = searchParams.get("acuerdo_id") || "";
    const estado = searchParams.get("estado") || "";
    let sql = `SELECT c.*, a.descripcion as acuerdo_desc FROM comisiones c LEFT JOIN acuerdos_comerciales a ON a.id = c.acuerdo_id WHERE 1=1`;
    const args: any[] = [];
    if (acuerdo_id) { sql += ` AND c.acuerdo_id = ?`; args.push(acuerdo_id); }
    if (estado)     { sql += ` AND c.estado = ?`;     args.push(estado); }
    sql += ` ORDER BY c.periodo ASC, c.empleado ASC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { acuerdo_id, empleado, periodo, base_calculo, porcentaje, importe, notas } = await req.json();
    if (!empleado || !periodo) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO comisiones (acuerdo_id, empleado, periodo, base_calculo, porcentaje, importe, notas)
       VALUES (?,?,?,?,?,?,?)`,
      [acuerdo_id || null, empleado, periodo, parseFloat(base_calculo) || 0, parseFloat(porcentaje) || 0, parseFloat(importe) || 0, notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
