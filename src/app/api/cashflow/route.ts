import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const meses = Array.from({ length: 12 }, (_, i) => {
      const mes = String(i + 1).padStart(2, '0');
      return { num: mes, label: new Date(year, i, 1).toLocaleDateString('es-AR', { month: 'long' }), inicio: `${year}-${mes}-01`, fin: `${year}-${mes}-31` };
    });

    const resultado = await Promise.all(meses.map(async m => {
      const ing = await db.get(`SELECT COALESCE(SUM(importe_total), 0) as t FROM facturas_emitidas WHERE estado IN ('cobro_pendiente', 'cobrada') AND fecha_vencimiento >= ? AND fecha_vencimiento <= ?`, [m.inicio, m.fin]);
      const eg = await db.get(`SELECT COALESCE(SUM(importe_total), 0) as t FROM facturas_recibidas WHERE estado = 'pendiente_pago' AND fecha_vencimiento >= ? AND fecha_vencimiento <= ?`, [m.inicio, m.fin]);
      const fiscal = await db.get(`SELECT COALESCE(SUM(importe), 0) as t FROM vencimientos_fiscales WHERE estado = 'pendiente' AND fecha_vencimiento >= ? AND fecha_vencimiento <= ?`, [m.inicio, m.fin]);
      const ingresos = Number(ing?.t || 0);
      const egresos = Number(eg?.t || 0);
      const fiscalAmt = Number(fiscal?.t || 0);
      return { mes: m.label, mesNum: m.num, ingresos, egresos_facturas: egresos, egresos_fiscales: fiscalAmt, total_egresos: egresos + fiscalAmt, saldo: ingresos - (egresos + fiscalAmt) };
    }));

    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
