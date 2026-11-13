/**
 * Cuenta corriente del proveedor — saldo derivado de facturas_recibidas.
 * Solo ve sus propias facturas (proveedor_id de sesión).
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "proveedor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const proveedor_id = (session.user as any).proveedor_id;
  if (!proveedor_id) return NextResponse.json({ error: "Sin proveedor asignado" }, { status: 400 });

  // Saldo = Σ facturas pendientes de pago
  const pendiente = await db.get(
    `SELECT COALESCE(SUM(importe_total), 0) AS total
     FROM facturas_recibidas
     WHERE proveedor_id = ? AND estado IN ('pendiente_revision', 'requiere_revision', 'pendiente_pago')`,
    [proveedor_id]
  );

  // Historial de movimientos: facturas pagadas con datos de pago
  const movimientos = await db.all(
    `SELECT id, tipo_comprobante, numero, fecha_emision, importe_total,
            fecha_pago, numero_op, estado
     FROM facturas_recibidas
     WHERE proveedor_id = ?
     ORDER BY COALESCE(fecha_pago, fecha_emision) DESC
     LIMIT 50`,
    [proveedor_id]
  );

  return NextResponse.json({
    saldo_pendiente: Number(pendiente?.total ?? 0),
    movimientos,
  });
}
