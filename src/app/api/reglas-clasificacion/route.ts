import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const rows = await db.all(
    `SELECT rc.*, pc.codigo as cuenta_codigo, pc.nombre as cuenta_nombre
     FROM reglas_clasificacion rc
     LEFT JOIN plan_cuentas pc ON pc.id=rc.cuenta_contable_id
     ORDER BY rc.prioridad DESC, rc.nombre`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { nombre, patron, tipo_match, categoria, cuenta_contable_id, descripcion_reemplazo, prioridad } = await req.json();
  if (!nombre?.trim() || !patron?.trim()) {
    return NextResponse.json({ error: "Nombre y patrón son obligatorios" }, { status: 400 });
  }
  const r = await db.run(
    `INSERT INTO reglas_clasificacion (nombre,patron,tipo_match,categoria,cuenta_contable_id,descripcion_reemplazo,prioridad)
     VALUES (?,?,?,?,?,?,?)`,
    [nombre.trim(), patron.trim(), tipo_match || "contiene", categoria || "", cuenta_contable_id ?? null, descripcion_reemplazo || "", Number(prioridad) || 0]
  );
  return NextResponse.json({ id: String(r.lastInsertRowid) }, { status: 201 });
}
