/**
 * GET /api/retenciones-config/certificados
 * Lista certificados de retención con filtros por período e impuesto.
 * Acepta ?anio=2026&mes=11&tipo=ganancias_sicore
 *
 * POST /api/retenciones-config/certificados
 * Genera número de certificado para retenciones que no lo tienen.
 * Body: { orden_pago_id: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const anio    = searchParams.get("anio")  || "";
  const mes     = searchParams.get("mes")   || "";
  const tipo    = searchParams.get("tipo")  || "";
  const formato = searchParams.get("formato") || "json"; // json | excel

  let sql = `
    SELECT ra.*, op.fecha, op.numero as op_numero, op.proveedor_id,
           p.razon_social, p.cuit
    FROM retenciones_aplicadas ra
    JOIN ordenes_pago op ON op.id = ra.orden_pago_id
    JOIN proveedores p   ON p.id  = op.proveedor_id
    WHERE op.estado IN ('emitida','pagada')
  `;
  const args: any[] = [];

  if (anio) { sql += ` AND strftime('%Y', op.fecha)=?`; args.push(anio); }
  if (mes)  { sql += ` AND strftime('%m', op.fecha)=?`; args.push(mes.padStart(2,"0")); }
  if (tipo) { sql += ` AND ra.tipo=?`; args.push(tipo); }
  sql += ` ORDER BY op.fecha DESC, ra.id`;

  const rows = await db.all(sql, args);

  if (formato === "excel") {
    const wb = XLSX.utils.book_new();
    const data = [
      ["N° Certificado", "Tipo", "Régimen", "Fecha OP", "N° OP", "CUIT Proveedor", "Razón Social", "Base", "Alícuota %", "Importe"],
      ...rows.map(r => [
        r.certificado_numero || "(sin número)",
        r.tipo,
        r.codigo_regimen || "",
        r.fecha,
        r.op_numero,
        r.cuit,
        r.razon_social,
        Number(r.base_calculo).toFixed(2),
        (Number(r.alicuota) * 100).toFixed(2),
        Number(r.importe).toFixed(2),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [10,20,12,12,12,16,30,14,10,12].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Certificados");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="certificados-retenciones-${anio || "todos"}-${mes || "todos"}.xlsx"`,
      },
    });
  }

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { orden_pago_id } = await req.json();
  if (!orden_pago_id) return NextResponse.json({ error: "orden_pago_id requerido" }, { status: 400 });

  const retenciones = await db.all(
    `SELECT ra.id, ra.tipo, ra.certificado_numero, op.fecha
     FROM retenciones_aplicadas ra
     JOIN ordenes_pago op ON op.id = ra.orden_pago_id
     WHERE ra.orden_pago_id=? AND (ra.certificado_numero IS NULL OR ra.certificado_numero='')`,
    [orden_pago_id]
  );

  if (retenciones.length === 0) {
    return NextResponse.json({ ok: true, generados: 0 });
  }

  let generados = 0;
  for (const ret of retenciones) {
    const anio = new Date(ret.fecha).getFullYear();
    // Número correlativo por tipo+año
    const countRow = await db.get(
      `SELECT COUNT(*) as n FROM retenciones_aplicadas ra
       JOIN ordenes_pago op ON op.id=ra.orden_pago_id
       WHERE ra.tipo=? AND strftime('%Y',op.fecha)=? AND ra.certificado_numero!=''`,
      [ret.tipo, String(anio)]
    );
    const seq = (Number(countRow?.n) || 0) + 1;
    const tipoCorto = (ret.tipo as string).replace("ganancias_sicore","GAN").replace("iibb_agip","AGIP").replace("iibb_arba","ARBA");
    const numero = `${tipoCorto}-${anio}-${String(seq).padStart(6, "0")}`;
    await db.run(
      `UPDATE retenciones_aplicadas SET certificado_numero=? WHERE id=?`,
      [numero, ret.id]
    );
    generados++;
  }

  return NextResponse.json({ ok: true, generados });
}
