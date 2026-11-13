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
    const estado = searchParams.get("estado") || "";
    const q = `%${search}%`;
    let sql = `SELECT a.*, c.razon_social as cliente_nombre
               FROM acuerdos_comerciales a LEFT JOIN clientes c ON c.id = a.cliente_id
               WHERE (a.descripcion LIKE ? OR a.responsable LIKE ? OR COALESCE(c.razon_social,'') LIKE ?)`;
    const args: any[] = [q, q, q];
    if (estado) { sql += ` AND a.estado = ?`; args.push(estado); }
    sql += ` ORDER BY COALESCE(a.fecha_inicio_iso, a.created_at) DESC`;
    const rows: any[] = await db.all(sql, args);
    // Desglose mensual (proyectado / real / gastos) de la planilla de comisiones y facturación real del cliente
    for (const a of rows) {
      const nom = a.presupuesto_cliente || a.cliente_original || "";
      a.presupuesto = nom ? await db.all(
        `SELECT periodo, ingresos_proyectados, ingresos_reales, gastos_comerciales FROM presupuesto_comercial
         WHERE LOWER(TRIM(cliente_nombre)) = LOWER(TRIM(?)) ORDER BY periodo`, [nom]) : [];
      a.facturas = a.cliente_id ? await db.all(
        `SELECT id, tipo_comprobante, punto_venta, numero, fecha_emision, importe_total as total, estado, fecha_cobro FROM facturas_emitidas
         WHERE cliente_id = ? ORDER BY fecha_emision`, [a.cliente_id]) : [];
    }
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { cliente_id, descripcion, tipo, fecha_inicio, fecha_fin, importe_mensual, moneda, comision_pct, responsable, notas } = await req.json();
    if (!descripcion) return NextResponse.json({ error: "Descripción es requerida" }, { status: 400 });
    const result = await db.run(
      `INSERT INTO acuerdos_comerciales (cliente_id, descripcion, tipo, fecha_inicio, fecha_fin, importe_mensual, moneda, comision_pct, responsable, notas)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [cliente_id || null, descripcion, tipo || "servicio", fecha_inicio || null, fecha_fin || null, parseFloat(importe_mensual) || 0, moneda || "ARS", parseFloat(comision_pct) || 0, responsable || "", notas || ""]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
