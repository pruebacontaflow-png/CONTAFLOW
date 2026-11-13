import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { checkPeriodoCerrado } from "@/lib/periodos";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const rows = await db.all(
    `SELECT op.*, p.razon_social, p.cuit, p.cbu
     FROM ordenes_pago op
     JOIN proveedores p ON p.id = op.proveedor_id
     ORDER BY op.fecha DESC, op.id DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const {
    proveedor_id,
    fecha,
    numero,
    factura_ids,        // number[] (puede ser vacío para anticipos)
    factura_importes,   // { [id]: number } — importe parcial por factura
    retenciones,        // { config_id?, tipo, descripcion, codigo_regimen, base_calculo, alicuota, importe }[]
    cuenta_bancaria_id,
    observaciones = "",
    concepto = "",       // descripción para anticipos
    es_anticipo = false,
    estado = "borrador",
  } = body;

  if (!proveedor_id || !fecha || !numero) {
    return NextResponse.json({ error: "Faltan campos obligatorios (proveedor_id, fecha, numero)" }, { status: 400 });
  }
  if (!es_anticipo && (!Array.isArray(factura_ids) || factura_ids.length === 0)) {
    return NextResponse.json({ error: "Seleccioná al menos una factura o marcá como anticipo" }, { status: 400 });
  }

  // Verificar período
  const err = await checkPeriodoCerrado(fecha);
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  // Calcular importe bruto desde las facturas o el campo explícito para anticipos
  let importe_bruto = 0;
  const itemsData: Array<{ factura_id: number; importe: number }> = [];

  if (!es_anticipo && factura_ids?.length > 0) {
    const facturas = await db.all(
      `SELECT id, importe_total FROM facturas_recibidas WHERE id IN (${factura_ids.map(() => "?").join(",")})`,
      factura_ids
    );
    for (const fac of facturas) {
      const parcial = factura_importes?.[String(fac.id)] ?? factura_importes?.[Number(fac.id)];
      const monto = parcial !== undefined && parcial !== null
        ? Math.min(Number(parcial), Number(fac.importe_total))
        : Number(fac.importe_total);
      importe_bruto += monto;
      itemsData.push({ factura_id: Number(fac.id), importe: +monto.toFixed(2) });
    }
  } else {
    // Anticipo: importe bruto viene del total de retenciones (no aplica) o puede venir del body
    importe_bruto = Number(body.importe_bruto) || 0;
  }

  const totalRet = (retenciones ?? []).reduce((s: number, r: any) => s + Number(r.importe), 0);
  const importe_neto = importe_bruto - totalRet;

  const r = await db.run(
    `INSERT INTO ordenes_pago (proveedor_id,fecha,numero,importe_bruto,total_retenciones,importe_neto,cuenta_bancaria_id,estado,observaciones,concepto,es_anticipo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [proveedor_id, fecha, numero, importe_bruto, totalRet, importe_neto,
     cuenta_bancaria_id || null, estado, observaciones, concepto, es_anticipo ? 1 : 0]
  );
  const ordenId = Number(r.lastInsertRowid);

  // Insertar items
  for (const item of itemsData) {
    await db.run(
      `INSERT INTO ordenes_pago_items (orden_pago_id,factura_id,importe) VALUES (?,?,?)`,
      [ordenId, item.factura_id, item.importe]
    );
  }

  // Insertar retenciones
  for (const ret of (retenciones ?? [])) {
    await db.run(
      `INSERT INTO retenciones_aplicadas (orden_pago_id,config_id,tipo,descripcion,codigo_regimen,base_calculo,alicuota,importe)
       VALUES (?,?,?,?,?,?,?,?)`,
      [ordenId, ret.config_id || null, ret.tipo, ret.descripcion, ret.codigo_regimen ?? "",
       Number(ret.base_calculo), Number(ret.alicuota), Number(ret.importe)]
    );
  }

  // Si estado=pagada → actualizar facturas
  if (estado === "pagada" && itemsData.length > 0) {
    await marcarFacturasPagadasParcial(itemsData, fecha, numero);
  }

  return NextResponse.json({ id: ordenId }, { status: 201 });
}

async function marcarFacturasPagadasParcial(
  items: Array<{ factura_id: number; importe: number }>,
  fecha: string,
  numero: string
) {
  for (const item of items) {
    const factura = await db.get(
      `SELECT importe_total FROM facturas_recibidas WHERE id=?`,
      [item.factura_id]
    );
    const total = Number(factura?.importe_total) || 0;

    // Sumar todo lo pagado hasta ahora (incluyendo este pago)
    const pagadoRow = await db.get(
      `SELECT COALESCE(SUM(opi.importe),0) as pagado
       FROM ordenes_pago_items opi
       JOIN ordenes_pago op ON op.id=opi.orden_pago_id
       WHERE opi.factura_id=? AND op.estado IN ('emitida','pagada')`,
      [item.factura_id]
    );
    const pagado = Number(pagadoRow?.pagado) || 0;

    if (pagado >= total - 0.01) {
      await db.run(
        `UPDATE facturas_recibidas SET estado='pagada', fecha_pago=?, numero_op=? WHERE id=?`,
        [fecha, numero, item.factura_id]
      );
    }
    // Si pagado < total: la factura permanece en pendiente_pago (pago parcial)
  }
}
