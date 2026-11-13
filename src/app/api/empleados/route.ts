import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const soloActivos = searchParams.get("soloActivos") || "";
    let sql = `SELECT * FROM empleados WHERE (nombre LIKE ? OR apellido LIKE ? OR cargo LIKE ? OR cuit LIKE ?)`;
    const q = `%${search}%`;
    const args: any[] = [q, q, q, q];
    if (soloActivos === "1") { sql += ` AND activo = 1`; }
    sql += ` ORDER BY apellido ASC, nombre ASC`;
    return NextResponse.json(await db.all(sql, args));
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { nombre, apellido, cuit, cuil, cargo, departamento, fecha_ingreso, salario_base, banco, cbu, convenio, categoria, notas } = await req.json();
    if (!nombre || !apellido) return NextResponse.json({ error: "Nombre y apellido son requeridos" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO empleados (nombre, apellido, cuit, cuil, cargo, departamento, fecha_ingreso, salario_base, banco, cbu, convenio, categoria, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [nombre, apellido, cuit || "", cuil || "", cargo || "", departamento || "", fecha_ingreso || null, salario_base || 0, banco || "", cbu || "", convenio || "", categoria || "", notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
