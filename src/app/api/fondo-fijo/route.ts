import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const movs = await db.all(`SELECT * FROM fondo_fijo_movimientos ORDER BY fecha DESC, id DESC LIMIT 200`);
    const saldo = await db.get(`SELECT saldo_resultante FROM fondo_fijo_movimientos ORDER BY fecha DESC, id DESC LIMIT 1`);
    return NextResponse.json({ movimientos: movs, saldo_actual: saldo?.saldo_resultante ?? 0 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const { fecha, tipo, importe, descripcion } = await req.json();
    if (!fecha || !tipo || !importe || !descripcion) return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
    // Calcular saldo
    const ultimo = await db.get(`SELECT saldo_resultante FROM fondo_fijo_movimientos ORDER BY fecha DESC, id DESC LIMIT 1`);
    const saldoAnterior = ultimo?.saldo_resultante ?? 0;
    const delta = tipo === "ingreso" ? parseFloat(importe) : -parseFloat(importe);
    const saldoNuevo = saldoAnterior + delta;
    const result = await db.run(
      `INSERT INTO fondo_fijo_movimientos (fecha, tipo, importe, descripcion, saldo_resultante) VALUES (?,?,?,?,?)`,
      [fecha, tipo, parseFloat(importe), descripcion, saldoNuevo]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid), saldo: saldoNuevo }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
