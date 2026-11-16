import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const semestre = parseInt(searchParams.get('semestre') || '1');
    const modulos = (searchParams.get('modulos') || '').split(',').filter(Boolean);

    const mesInicio = semestre === 1 ? '01' : '07';
    const mesFin = semestre === 1 ? '06' : '12';
    const fi = `${year}-${mesInicio}-01`;
    const ff = `${year}-${mesFin}-31`;
    const resultado: Record<string, any> = {};

    if (!modulos.length || modulos.includes('estado_resultados')) {
      const ingresos = await db.all(
        `SELECT fe.tipo_comprobante as codigo, 'Ventas tipo '||fe.tipo_comprobante as descripcion, 'ingreso' as tipo, SUM(fe.importe_neto) as importe FROM facturas_emitidas fe WHERE fe.fecha_emision >= ? AND fe.fecha_emision <= ? GROUP BY fe.tipo_comprobante`,
        [fi, ff]
      );
      const egresos = await db.all(
        `SELECT fr.tipo_comprobante as codigo, 'Compras tipo '||fr.tipo_comprobante as descripcion, 'gasto' as tipo, SUM(fr.importe_neto) as importe FROM facturas_recibidas fr WHERE fr.fecha_emision >= ? AND fr.fecha_emision <= ? GROUP BY fr.tipo_comprobante`,
        [fi, ff]
      );
      const totalIngresos = ingresos.reduce((a, i) => a + Number(i.importe), 0);
      const totalEgresos = egresos.reduce((a, e) => a + Number(e.importe), 0);
      resultado.estado_resultados = { lineas: [...ingresos, ...egresos], total_ingresos: totalIngresos, total_egresos: totalEgresos, resultado_neto: totalIngresos - totalEgresos };
    }

    if (!modulos.length || modulos.includes('iva_compras')) {
      resultado.iva_compras = await db.all(`SELECT fr.*, p.razon_social, p.cuit FROM facturas_recibidas fr JOIN proveedores p ON p.id = fr.proveedor_id WHERE fr.fecha_emision >= ? AND fr.fecha_emision <= ? ORDER BY fr.fecha_emision`, [fi, ff]);
    }
    if (!modulos.length || modulos.includes('iva_ventas')) {
      resultado.iva_ventas = await db.all(`SELECT fe.*, c.razon_social, c.cuit FROM facturas_emitidas fe JOIN clientes c ON c.id = fe.cliente_id WHERE fe.fecha_emision >= ? AND fe.fecha_emision <= ? ORDER BY fe.fecha_emision`, [fi, ff]);
    }
    if (!modulos.length || modulos.includes('facturas_recibidas')) {
      resultado.facturas_recibidas = await db.all(`SELECT fr.*, p.razon_social, p.cuit FROM facturas_recibidas fr JOIN proveedores p ON p.id = fr.proveedor_id WHERE fr.fecha_emision >= ? AND fr.fecha_emision <= ? ORDER BY fr.fecha_emision`, [fi, ff]);
    }
    if (!modulos.length || modulos.includes('facturas_emitidas')) {
      resultado.facturas_emitidas = await db.all(`SELECT fe.*, c.razon_social, c.cuit FROM facturas_emitidas fe JOIN clientes c ON c.id = fe.cliente_id WHERE fe.fecha_emision >= ? AND fe.fecha_emision <= ? ORDER BY fe.fecha_emision`, [fi, ff]);
    }

    return NextResponse.json(resultado);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
