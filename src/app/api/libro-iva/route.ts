/**
 * GET /api/libro-iva?tipo=compras|ventas&anio=YYYY&mes=MM
 * Retorna facturas en formato Libro IVA con desglose por alícuota.
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
  const tipo = searchParams.get("tipo") || "compras";
  const anio = searchParams.get("anio") || new Date().getFullYear().toString();
  const mes  = searchParams.get("mes")  || (new Date().getMonth() + 1).toString().padStart(2, "0");
  const mesPad = mes.padStart(2, "0");
  const periodo = `${anio}-${mesPad}`;

  let facturas: any[];

  if (tipo === "compras") {
    facturas = await db.all(
      `SELECT fr.id, fr.fecha_emision, fr.tipo_comprobante, fr.punto_venta, fr.numero,
              fr.cuit_emisor, COALESCE(p.razon_social, fr.cuit_emisor) AS razon_social,
              fr.neto_gravado, fr.neto_no_gravado, fr.exento,
              fr.tipo_iva, fr.importe_iva,
              fr.percepcion_iva, fr.percepcion_iibb, fr.percepcion_otras,
              fr.importe_total, fr.estado
       FROM facturas_recibidas fr
       LEFT JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE strftime('%Y-%m', fr.fecha_emision) = ?
         AND fr.estado NOT IN ('rechazada','pendiente_revision','requiere_revision')
       ORDER BY fr.fecha_emision, fr.numero`,
      [periodo]
    );
  } else {
    facturas = await db.all(
      `SELECT fe.id, fe.fecha_emision, fe.tipo_comprobante, fe.punto_venta, fe.numero,
              fe.cuit_receptor AS cuit_emisor, COALESCE(c.razon_social, fe.cuit_receptor) AS razon_social,
              fe.neto_gravado, fe.neto_no_gravado, fe.exento,
              fe.tipo_iva, fe.importe_iva,
              fe.percepcion_iva, fe.percepcion_iibb, fe.percepcion_otras,
              fe.importe_total, fe.estado
       FROM facturas_emitidas fe
       LEFT JOIN clientes c ON c.id = fe.cliente_id
       WHERE strftime('%Y-%m', fe.fecha_emision) = ?
         AND fe.estado NOT IN ('rechazada')
       ORDER BY fe.fecha_emision, fe.numero`,
      [periodo]
    );
  }

  // Para cada factura, traer detalle IVA si existe
  const tabla = tipo === "compras" ? "recibidas" : "emitidas";
  const ids = facturas.map(f => Number(f.id));
  let detalleMap: Record<number, any[]> = {};
  if (ids.length > 0) {
    const det = await db.all(
      `SELECT factura_id, alicuota, base_imponible, importe
       FROM facturas_iva_detalle
       WHERE tabla=? AND factura_id IN (${ids.map(() => "?").join(",")})`,
      [tabla, ...ids]
    );
    for (const d of det) {
      const fid = Number(d.factura_id);
      if (!detalleMap[fid]) detalleMap[fid] = [];
      detalleMap[fid].push(d);
    }
  }

  // Combinar: si hay detalle, usarlo; si no, reconstruir del campo tipo_iva
  const rows = facturas.map(f => {
    const det = detalleMap[Number(f.id)];
    let iva21 = 0, iva105 = 0, iva25 = 0, ivaOtro = 0;

    if (det && det.length > 0) {
      for (const d of det) {
        const pct = String(d.alicuota);
        const imp = Number(d.importe);
        if (pct === "21%") iva21 += imp;
        else if (pct === "10.5%") iva105 += imp;
        else if (pct === "2.5%") iva25 += imp;
        else ivaOtro += imp;
      }
    } else {
      // Fallback: campo tipo_iva
      const total = Number(f.importe_iva) || 0;
      if (f.tipo_iva === "21%")    iva21  = total;
      else if (f.tipo_iva === "10.5%") iva105 = total;
      else if (f.tipo_iva === "2.5%")  iva25  = total;
      else if (f.tipo_iva !== "exento" && f.tipo_iva !== "no_gravado") ivaOtro = total;
    }

    return {
      id: f.id,
      fecha: f.fecha_emision,
      tipo_comprobante: f.tipo_comprobante,
      punto_venta: f.punto_venta || "",
      numero: f.numero,
      cuit: f.cuit_emisor || "",
      razon_social: f.razon_social || "",
      neto_gravado: Number(f.neto_gravado) || 0,
      neto_no_gravado: Number(f.neto_no_gravado) || 0,
      exento: Number(f.exento) || 0,
      iva21, iva105, iva25, iva_otro: ivaOtro,
      percepcion_iva: Number(f.percepcion_iva) || 0,
      percepcion_iibb: Number(f.percepcion_iibb) || 0,
      percepcion_otras: Number(f.percepcion_otras) || 0,
      total: Number(f.importe_total) || 0,
      estado: f.estado,
    };
  });

  // Totales
  const totales = rows.reduce((acc, r) => ({
    neto_gravado: acc.neto_gravado + r.neto_gravado,
    neto_no_gravado: acc.neto_no_gravado + r.neto_no_gravado,
    exento: acc.exento + r.exento,
    iva21: acc.iva21 + r.iva21,
    iva105: acc.iva105 + r.iva105,
    iva25: acc.iva25 + r.iva25,
    iva_otro: acc.iva_otro + r.iva_otro,
    percepcion_iva: acc.percepcion_iva + r.percepcion_iva,
    percepcion_iibb: acc.percepcion_iibb + r.percepcion_iibb,
    percepcion_otras: acc.percepcion_otras + r.percepcion_otras,
    total: acc.total + r.total,
  }), { neto_gravado:0, neto_no_gravado:0, exento:0, iva21:0, iva105:0, iva25:0, iva_otro:0, percepcion_iva:0, percepcion_iibb:0, percepcion_otras:0, total:0 });

  return NextResponse.json({ periodo, tipo, facturas: rows, totales });
}
