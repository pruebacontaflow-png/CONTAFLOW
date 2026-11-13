/**
 * GET /api/cuentas-corrientes
 * Sin parámetros: aging de saldos pendientes por proveedor.
 * Con ?proveedor_id=X: historial completo de movimientos con saldo corrido.
 */
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
  const proveedorId = searchParams.get("proveedor_id");

  if (proveedorId) {
    return getHistorialProveedor(Number(proveedorId));
  }
  return getAgingResumen();
}

async function getHistorialProveedor(proveedorId: number) {
  const proveedor = await db.get(
    `SELECT id, razon_social, cuit FROM proveedores WHERE id=?`,
    [proveedorId]
  );
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });

  // Facturas: cargo (+)
  const facturas = await db.all(
    `SELECT 'factura' as tipo, fr.id, fr.fecha_emision as fecha, fr.fecha_vencimiento,
            (fr.tipo_comprobante || '-' || fr.numero) as referencia,
            fr.importe_total as monto, 0 as es_pago, fr.estado
     FROM facturas_recibidas fr
     WHERE fr.proveedor_id=?
     ORDER BY fr.fecha_emision`,
    [proveedorId]
  );

  // Pagos: descargo (-)
  const pagos = await db.all(
    `SELECT 'pago' as tipo, op.id, op.fecha, NULL as fecha_vencimiento,
            ('OP-' || op.numero) as referencia,
            op.importe_neto as monto, 1 as es_pago, op.estado
     FROM ordenes_pago op
     WHERE op.proveedor_id=? AND op.estado IN ('emitida','pagada')
     ORDER BY op.fecha`,
    [proveedorId]
  );

  // Combinar y ordenar por fecha
  const movimientos: any[] = [
    ...facturas.map((f: any) => ({ ...f, monto: Number(f.monto) })),
    ...pagos.map((p: any) => ({ ...p, monto: -Number(p.monto) })),
  ].sort((a: any, b: any) => {
    if (a.fecha < b.fecha) return -1;
    if (a.fecha > b.fecha) return 1;
    // Pagos después de facturas en el mismo día
    return Number(a.es_pago) - Number(b.es_pago);
  });

  // Calcular saldo corrido
  let saldo = 0;
  for (const mov of movimientos) {
    saldo += mov.monto;
    mov.saldo_corrido = +saldo.toFixed(2);
  }

  // Totales para aging (solo facturas pendientes)
  const hoy = new Date().toISOString().split("T")[0];
  const aging = { corriente: 0, vencida_30: 0, vencida_60: 0, vencida_90: 0, vencida_mas: 0, total: 0 };
  for (const f of facturas) {
    if (!["pendiente_pago", "pendiente_revision", "observada"].includes(String(f.estado))) continue;
    const dias = Math.round((new Date(hoy).getTime() - new Date(String(f.fecha_vencimiento)).getTime()) / 86400000);
    const imp  = Number(f.monto);
    aging.total += imp;
    if (dias <= 0)       aging.corriente   += imp;
    else if (dias <= 30) aging.vencida_30  += imp;
    else if (dias <= 60) aging.vencida_60  += imp;
    else if (dias <= 90) aging.vencida_90  += imp;
    else                 aging.vencida_mas += imp;
  }

  return NextResponse.json({ proveedor, movimientos, saldo_actual: +saldo.toFixed(2), aging });
}

async function getAgingResumen() {
  const hoy = new Date().toISOString().split("T")[0];

  const facturas = await db.all(
    `SELECT fr.id, fr.proveedor_id, fr.tipo_comprobante, fr.numero, fr.fecha_emision,
            fr.fecha_vencimiento, fr.importe_total,
            p.razon_social, p.cuit
     FROM facturas_recibidas fr
     JOIN proveedores p ON p.id = fr.proveedor_id
     WHERE fr.estado IN ('pendiente_pago')
     ORDER BY p.razon_social, fr.fecha_vencimiento`
  );

  const mapa: Record<number, any> = {};
  for (const f of facturas) {
    const pid = Number(f.proveedor_id);
    if (!mapa[pid]) {
      mapa[pid] = {
        proveedor_id: pid, razon_social: f.razon_social, cuit: f.cuit,
        total: 0, corriente: 0, vencida_30: 0, vencida_60: 0, vencida_90: 0, vencida_mas: 0,
        facturas: [] as any[],
      };
    }
    const dias   = Math.round((new Date(hoy).getTime() - new Date(String(f.fecha_vencimiento)).getTime()) / 86400000);
    const importe = Number(f.importe_total);
    mapa[pid].total += importe;
    if (dias <= 0)       mapa[pid].corriente   += importe;
    else if (dias <= 30) mapa[pid].vencida_30  += importe;
    else if (dias <= 60) mapa[pid].vencida_60  += importe;
    else if (dias <= 90) mapa[pid].vencida_90  += importe;
    else                 mapa[pid].vencida_mas += importe;
    mapa[pid].facturas.push({
      id: f.id, tipo_comprobante: f.tipo_comprobante, numero: f.numero,
      fecha_emision: f.fecha_emision, fecha_vencimiento: f.fecha_vencimiento,
      importe_total: importe, dias_vencida: dias,
    });
  }

  return NextResponse.json(Object.values(mapa).sort((a, b) => b.total - a.total));
}
