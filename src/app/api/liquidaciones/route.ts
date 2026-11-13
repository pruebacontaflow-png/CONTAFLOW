import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const empleado_id = searchParams.get("empleado_id") || "";
    const periodo = searchParams.get("periodo") || "";
    let sql = `SELECT l.*, e.nombre || ' ' || e.apellido as empleado_nombre
               FROM liquidaciones l LEFT JOIN empleados e ON e.id = l.empleado_id WHERE 1=1`;
    const args: any[] = [];
    if (empleado_id) { sql += ` AND l.empleado_id = ?`; args.push(empleado_id); }
    if (periodo)     { sql += ` AND l.periodo LIKE ?`;  args.push(`%${periodo}%`); }
    sql += ` ORDER BY l.periodo DESC, e.apellido ASC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { empleado_id, periodo, salario_bruto, horas_extra, bonificaciones, descuento_jubilacion, descuento_obra_social, descuento_sindical, otros_descuentos, fecha_pago, notas } = await req.json();
    if (!empleado_id || !periodo) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    const bruto = (parseFloat(salario_bruto) || 0) + (parseFloat(horas_extra) || 0) + (parseFloat(bonificaciones) || 0);
    const descuentos = (parseFloat(descuento_jubilacion) || 0) + (parseFloat(descuento_obra_social) || 0) + (parseFloat(descuento_sindical) || 0) + (parseFloat(otros_descuentos) || 0);
    const neto = bruto - descuentos;
    const result = await db.run(
      `INSERT INTO liquidaciones (empleado_id, periodo, salario_bruto, horas_extra, bonificaciones, descuento_jubilacion, descuento_obra_social, descuento_sindical, otros_descuentos, neto, fecha_pago, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [empleado_id, periodo, parseFloat(salario_bruto) || 0, parseFloat(horas_extra) || 0, parseFloat(bonificaciones) || 0, parseFloat(descuento_jubilacion) || 0, parseFloat(descuento_obra_social) || 0, parseFloat(descuento_sindical) || 0, parseFloat(otros_descuentos) || 0, neto, fecha_pago || null, notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
