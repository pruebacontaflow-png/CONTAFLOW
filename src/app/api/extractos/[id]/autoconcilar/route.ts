/**
 * POST /api/extractos/[id]/autoconcilar
 * Intenta conciliar automáticamente las líneas del extracto con:
 * - Órdenes de pago (débitos del extracto)
 * - Facturas emitidas cobradas (créditos del extracto)
 * Criterio: misma fecha ±5 días, mismo importe (redondeado al peso)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

function daysDiff(a: string, b: string): number {
  return Math.abs(Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86400000));
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const extracto = await db.get(`SELECT * FROM extractos_bancarios WHERE id=?`, [params.id]);
  if (!extracto) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const lineas = await db.all(
    `SELECT * FROM extractos_lineas WHERE extracto_id=? AND conciliado=0`,
    [params.id]
  );

  // Traer candidatos: órdenes de pago pagadas (para débitos) y facturas emitidas cobradas (para créditos)
  const ordenes = await db.all(
    `SELECT id, fecha, importe_neto as importe FROM ordenes_pago WHERE estado='pagada'`
  );
  const facturas = await db.all(
    `SELECT id, fecha_emision as fecha, importe_total as importe FROM facturas_emitidas WHERE estado IN ('cobrada','pagada')`
  );

  let conciliadas = 0;

  for (const linea of lineas) {
    if (linea.debito > 0) {
      // Buscar en órdenes de pago
      const candidato = ordenes.find(op => {
        const montoOk = Math.abs(Number(op.importe) - Number(linea.debito)) < 1;
        const fechaOk = daysDiff(String(op.fecha), String(linea.fecha)) <= 5;
        return montoOk && fechaOk;
      });
      if (candidato) {
        await db.run(
          `UPDATE extractos_lineas SET conciliado=1, referencia_tipo='orden_pago', referencia_id=? WHERE id=?`,
          [candidato.id, linea.id]
        );
        conciliadas++;
      }
    } else if (linea.credito > 0) {
      // Buscar en facturas emitidas cobradas
      const candidato = facturas.find(fe => {
        const montoOk = Math.abs(Number(fe.importe) - Number(linea.credito)) < 1;
        const fechaOk = daysDiff(String(fe.fecha), String(linea.fecha)) <= 5;
        return montoOk && fechaOk;
      });
      if (candidato) {
        await db.run(
          `UPDATE extractos_lineas SET conciliado=1, referencia_tipo='factura_emitida', referencia_id=? WHERE id=?`,
          [candidato.id, linea.id]
        );
        conciliadas++;
      }
    }
  }

  return NextResponse.json({ conciliadas, total: lineas.length });
}
