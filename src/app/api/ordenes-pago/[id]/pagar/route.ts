/**
 * POST /api/ordenes-pago/[id]/pagar
 * Marca la orden como pagada, actualiza facturas, genera asiento automático.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import fs from "fs";
import path from "path";
import { asientoPago } from "@/lib/asientos-auto";
import { checkPeriodoCerrado } from "@/lib/periodos";

const PDF_DIR = path.join(process.cwd(), "facturas-pdf");

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const orden = await db.get(
    `SELECT op.*, p.razon_social FROM ordenes_pago op JOIN proveedores p ON p.id=op.proveedor_id WHERE op.id=?`,
    [params.id]
  );
  if (!orden) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  if (orden.estado === "pagada") return NextResponse.json({ error: "Ya estaba pagada" }, { status: 400 });

  // Verificar período
  const err = await checkPeriodoCerrado(String(orden.fecha));
  if (err) return NextResponse.json({ error: err }, { status: 422 });

  let comprobantePath = String(orden.comprobante_path || "");

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const pdfFile = formData.get("comprobante") as File | null;
    if (pdfFile && pdfFile.type === "application/pdf") {
      fs.mkdirSync(PDF_DIR, { recursive: true });
      const filename = `OP-${orden.numero.replace(/\//g, "-")}-comprobante.pdf`;
      const buf = Buffer.from(await pdfFile.arrayBuffer());
      fs.writeFileSync(path.join(PDF_DIR, filename), buf);
      comprobantePath = filename;
    }
  }

  await db.run(
    `UPDATE ordenes_pago SET estado='pagada', comprobante_path=? WHERE id=?`,
    [comprobantePath, params.id]
  );

  // Obtener items con sus importes
  const items = await db.all(
    `SELECT factura_id, importe FROM ordenes_pago_items WHERE orden_pago_id=?`,
    [params.id]
  );

  // Actualizar facturas según si el pago es total o parcial
  for (const item of items) {
    const fid    = Number(item.factura_id);
    const monto  = Number(item.importe);
    const factura = await db.get(`SELECT importe_total FROM facturas_recibidas WHERE id=?`, [fid]);
    const total   = Number(factura?.importe_total) || 0;

    // Sumar todo lo pagado hasta ahora
    const pagadoRow = await db.get(
      `SELECT COALESCE(SUM(opi.importe),0) as pagado
       FROM ordenes_pago_items opi
       JOIN ordenes_pago op ON op.id=opi.orden_pago_id
       WHERE opi.factura_id=? AND op.estado IN ('emitida','pagada')`,
      [fid]
    );
    const pagado = Number(pagadoRow?.pagado) || 0;

    if (pagado >= total - 0.01) {
      await db.run(
        `UPDATE facturas_recibidas SET estado='pagada', fecha_pago=?, numero_op=?, comprobante_pago_path=? WHERE id=?`,
        [orden.fecha, orden.numero, comprobantePath, fid]
      );
    } else {
      // Pago parcial: solo actualizar comprobante
      await db.run(
        `UPDATE facturas_recibidas SET comprobante_pago_path=? WHERE id=?`,
        [comprobantePath, fid]
      );
    }
  }

  // Generar números de certificado para las retenciones de esta OP
  generarCertificados(Number(params.id)).catch(e => console.warn("generarCertificados:", e));

  // Asiento automático
  asientoPago(Number(params.id)).catch(e => console.warn("asientoPago:", e));

  return NextResponse.json({ ok: true, facturasActualizadas: items.length });
}

async function generarCertificados(ordenId: number) {
  const retenciones = await db.all(
    `SELECT ra.id, ra.tipo, op.fecha
     FROM retenciones_aplicadas ra
     JOIN ordenes_pago op ON op.id=ra.orden_pago_id
     WHERE ra.orden_pago_id=? AND (ra.certificado_numero IS NULL OR ra.certificado_numero='')`,
    [ordenId]
  );
  for (const ret of retenciones) {
    const anio = new Date(ret.fecha).getFullYear();
    const countRow = await db.get(
      `SELECT COUNT(*) as n FROM retenciones_aplicadas ra
       JOIN ordenes_pago op ON op.id=ra.orden_pago_id
       WHERE ra.tipo=? AND strftime('%Y',op.fecha)=? AND ra.certificado_numero!='' AND ra.certificado_numero IS NOT NULL`,
      [ret.tipo, String(anio)]
    );
    const seq = (Number(countRow?.n) || 0) + 1;
    const tipoCorto = (ret.tipo as string)
      .replace("ganancias_sicore","GAN").replace("iibb_agip","AGIP").replace("iibb_arba","ARBA");
    const numero = `${tipoCorto}-${anio}-${String(seq).padStart(6,"0")}`;
    await db.run(`UPDATE retenciones_aplicadas SET certificado_numero=? WHERE id=?`, [numero, ret.id]);
  }
}
