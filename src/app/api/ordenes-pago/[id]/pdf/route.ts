import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { SimplePDF, fmtTango, numeroALetras } from "@/lib/pdf-simple";

const fmtFecha = (iso: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso || "");
const TIPO_CORTO: Record<string, string> = { "Factura": "FAC", "Nota de Crédito": "NC", "Nota de Débito": "ND", "Recibo": "REC", "Invoice": "INV" };
const corto = (t: string) => { const k = Object.keys(TIPO_CORTO).find(k => (t || "").startsWith(k)); return k ? TIPO_CORTO[k] : (t || "").slice(0, 4).toUpperCase(); };
const letra = (t: string) => ((t || "").match(/\s([ABCEM])$/)?.[1] || "");

async function param(clave: string, def: string) {
  const r: any = await db.get(`SELECT valor FROM parametros WHERE clave = ?`, [clave]);
  return r?.valor || def;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("No autorizado", { status: 401 });
  const tipo = req.nextUrl.searchParams.get("tipo") || "op";

  const op: any = await db.get(
    `SELECT op.*, COALESCE(p.razon_social, op.nombre_en_banco) AS proveedor, COALESCE(p.cuit, op.cuit_proveedor) AS cuit, p.direccion, p.codigo_proveedor, p.cbu,
            cb.banco AS banco_nombre, pc.codigo AS cuenta_codigo, pc.nombre AS cuenta_nombre,
            el.fecha AS banco_fecha, el.descripcion AS banco_desc
     FROM ordenes_pago op
     LEFT JOIN proveedores p ON p.id = op.proveedor_id
     LEFT JOIN cuentas_bancarias cb ON cb.id = op.cuenta_bancaria_id
     LEFT JOIN plan_cuentas pc ON pc.id = cb.cuenta_contable_id
     LEFT JOIN extractos_lineas el ON el.id = op.linea_extracto_id
     WHERE op.id = ?`, [params.id]);
  if (!op) return new NextResponse("Orden de pago no encontrada", { status: 404 });

  const items: any[] = await db.all(
    `SELECT i.importe, i.descripcion, f.tipo_comprobante, f.punto_venta, f.numero, f.fecha_vencimiento, f.fecha_emision, f.importe_total
     FROM ordenes_pago_items i LEFT JOIN facturas_recibidas f ON f.id = i.factura_id WHERE i.orden_pago_id = ? ORDER BY i.id`, [op.id]);
  const rets: any[] = await db.all(`SELECT * FROM retenciones_aplicadas WHERE orden_pago_id = ? ORDER BY id`, [op.id]);

  // El PDF siempre lo genera ContaFlow. Con ?original=1 se puede ver el PDF que emitió Tango (respaldo histórico)
  const fs = await import("fs"); const pathMod = await import("path");
  const original = tipo === "retencion" ? String(op.tango_ret_paths || "").split(";").filter(Boolean)[0] : op.tango_pdf_path;
  if (original && req.nextUrl.searchParams.get("original") === "1") {
    const full = pathMod.join(process.cwd(), original);
    if (fs.existsSync(full)) {
      return new NextResponse(new Uint8Array(fs.readFileSync(full)), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pathMod.basename(full)}"` },
      });
    }
  }

  const empresa = await param("empresa_razon_social", "IT CLICK VIDEO SA");
  const domicilio = await param("empresa_domicilio", "Avda. del Libertador 6810-P.18");
  const localidad = await param("empresa_localidad", "C.A.B.A.");
  const cuitEmp = await param("empresa_cuit", "30-71475972-4");
  const firmante = await param("empresa_firmante", "Lucas Jinkis");
  const cargo = await param("empresa_firmante_cargo", "Presidente");

  const pdf = new SimplePDF();
  const L = 18, R = 577, W = R - L;
  const nombreArchivo = `${op.numero || "OP"} - ${(op.proveedor || "").replace(/[\\/:*?"<>|]/g, "")}`;

  if (tipo === "retencion") {
    if (!rets.length) return new NextResponse("Esta orden de pago no tiene retenciones", { status: 404 });
    for (const r of rets) {
      for (let copia = 0; copia < 2; copia++) {
        if (r !== rets[0] || copia > 0) pdf.addPage();
        let y = 40;
        pdf.text(L, y, empresa.toUpperCase(), 10); y += 12;
        pdf.text(L, y, domicilio, 10); y += 12;
        pdf.text(L, y, localidad, 10); y += 24;
        pdf.text(L, y, `C.U.I.T- ${cuitEmp}`, 10); y += 24;
        pdf.text(L, y, "Comprobante de Retención", 10); y += 26;
        pdf.text(200, y, `Nro           : ${r.certificado_numero || ""}`, 10); y += 12;
        pdf.text(200, y, `O/P           : ${op.op_nro_tango || op.numero || ""}`, 10); y += 12;
        pdf.text(200, y, `Fecha         : ${fmtFecha(r.fecha || op.fecha)}`, 10); y += 26;
        pdf.text(L, y, "Apellido y Nombre o", 10); y += 12;
        pdf.text(L, y, `Razón Social     :  ${(r.retenido || op.proveedor || "").toUpperCase()}`, 10); y += 12;
        pdf.text(L, y, `Domicilio        :  ${op.direccion || ""}`, 10); y += 24;
        pdf.text(L, y, `Nro. de C.U.I.T. :  ${r.cuit_retenido || op.cuit || ""}`, 10); y += 24;
        const concepto = String(r.descripcion || "").replace(/^Imp(to|uesto)\.? a las Ganancias\s*-\s*/i, "");
        pdf.text(L, y, `Impuesto          : ${r.tipo === "ganancias" ? "Impuesto a las Ganancias" : (r.tipo || "")}`, 10); y += 12;
        pdf.text(L, y, `Concepto del Pago : ${concepto}`.slice(0, 84), 10); y += 12;
        pdf.text(L, y, `Código de Régimen : ${r.codigo_regimen || ""}`, 10); y += 12;
        if (r.comprobante_origen) { pdf.text(L, y, `Comprobante origen: ${String(r.comprobante_origen).slice(0, 72)}`, 10); y += 12; }
        pdf.text(L, y, `Importe pagado sujeto a retención :   ${Number(r.base_calculo || 0).toFixed(2)}`, 10); y += 12;
        if (r.alicuota) { pdf.text(L, y, `Alícuota aplicada                 :   ${Number(r.alicuota).toFixed(2)} %`, 10); y += 12; }
        pdf.text(L, y, `Importe retenido                  :   ${Number(r.importe || 0).toFixed(2)}`, 10); y += 24;
        pdf.text(L, y, `Por ${empresa.toUpperCase()}`, 10); y += 36;
        pdf.text(250, y, "..............................", 10); y += 12;
        pdf.text(250, y, firmante, 10); y += 12;
        pdf.text(250, y, cargo, 10); y += 30;
        pdf.text(L, y, "Declaro que los datos consignados en este Formulario son correctos y", 10); y += 12;
        pdf.text(L, y, "completos sin omitir ni falsear dato alguno que deba contener, siendo", 10); y += 12;
        pdf.text(L, y, "fiel expresión de la verdad.", 10); y += 24;
        pdf.text(L, y, copia === 0 ? "ORIGINAL" : "DUPLICADO", 8);
      }
    }
  } else {
    // ── Encabezado
    pdf.rect(L, 28, W, 72);
    pdf.textCenter(L + W / 2, 42, "O R D E N    D E    P A G O", 10);
    pdf.text(L + 4, 60, `NºOrden de Pago: ${op.op_nro_tango && /^\d{13}$/.test(String(op.op_nro_tango)) ? op.op_nro_tango : (op.numero || "")}`, 10);
    pdf.text(410, 60, `Fecha    : ${fmtFecha(op.fecha)}`, 10);
    pdf.text(L + 4, 72, `Proveedor      : ${op.codigo_proveedor ? op.codigo_proveedor + " " : ""}${(op.proveedor || "").toUpperCase()}`.slice(0, 64), 10);
    pdf.text(L + 4, 84, `C.U.I.T.       : ${op.cuit || ""}`, 10);
    if (op.cbu) pdf.text(L + 4, 96, `C.B.U.         : ${op.cbu}`, 10);
    if (op.op_nro_tango && !/^\d{13}$/.test(String(op.op_nro_tango))) pdf.text(410, 84, `OP Tango : ${op.op_nro_tango}`, 10);

    // ── Imputación
    pdf.textCenter(L + W / 2, 108, "IMPUTACION", 10);
    const xs = [L, 105, 280, 420, R];
    const top = 112, head = 26;
    const rowsH = Math.max(80, items.length * 13 + 14);
    pdf.rect(L, top, W, head + rowsH);
    pdf.line(L, top + head, R, top + head);
    for (const x of xs.slice(1, -1)) pdf.line(x, top, x, top + head + rowsH);
    pdf.textCenter((xs[0] + xs[1]) / 2, top + 17, "Tipo Comp.", 10);
    pdf.textCenter((xs[1] + xs[2]) / 2, top + 17, "Nro. Comprobante", 10);
    pdf.textCenter((xs[2] + xs[3]) / 2, top + 17, "Fecha Vto.", 10);
    pdf.textCenter((xs[3] + xs[4]) / 2, top + 17, "Importe", 10);
    let total = 0, y = top + head + 14;
    for (const it of items) {
      const imp = Number(it.importe) || Number(it.importe_total) || 0;
      const signo = String(it.tipo_comprobante || "").startsWith("Nota de Cr") ? -Math.abs(imp) : imp;
      total += signo;
      const nro = it.numero ? `${letra(it.tipo_comprobante)}${String(it.punto_venta || "").padStart(5, "0")}${String(it.numero).padStart(8, "0")}` : (it.descripcion || "");
      pdf.textCenter((xs[0] + xs[1]) / 2, y, corto(it.tipo_comprobante || "") || "—", 10);
      pdf.textCenter((xs[1] + xs[2]) / 2, y, nro, 10);
      pdf.textCenter((xs[2] + xs[3]) / 2, y, fmtFecha(it.fecha_vencimiento || ""), 10);
      pdf.textRight(R - 22, y, fmtTango(signo), 10);
      y += 13;
    }
    const bruto = Number(op.importe_bruto) || total;
    const pagoCuenta = Math.max(0, Math.round((bruto - total) * 100) / 100);
    let y2 = top + head + rowsH;
    pdf.rect(L, y2, W, 22); pdf.line(xs[3], y2, xs[3], y2 + 44);
    pdf.text(300, y2 + 14, "PAGO A CUENTA:", 10); pdf.textRight(R - 22, y2 + 14, fmtTango(pagoCuenta), 10);
    pdf.rect(L, y2 + 22, W, 22);
    pdf.text(300, y2 + 36, "TOTAL        :", 10); pdf.textRight(R - 22, y2 + 36, fmtTango(bruto), 10);

    // ── Retenciones y neto
    y2 += 56;
    const lineasRet = rets.length ? rets : [];
    const hRet = 22 * (lineasRet.length + 1);
    pdf.rect(L, y2, W, hRet); pdf.line(xs[3], y2, xs[3], y2 + hRet);
    let yr = y2 + 14;
    for (const r of lineasRet) {
      const nombre = r.tipo === "ganancias" ? "Retención Impuesto a las Ganancias" : r.tipo === "iibb" ? "Retención Ingresos Brutos" : `Retención ${r.tipo || ""}`;
      pdf.text(140, yr, `${nombre} :`, 10); pdf.textRight(R - 22, yr, fmtTango(r.importe), 10);
      pdf.line(L, yr + 8, R, yr + 8); yr += 22;
    }
    const neto = Number(op.importe_neto) || bruto - (Number(op.total_retenciones) || 0);
    pdf.text(140, yr, "NETO A ABONAR                          :", 10); pdf.textRight(R - 22, yr, fmtTango(neto), 10);

    // ── Cheques / Documentos (vacío, igual que Tango)
    y2 += hRet + 12;
    pdf.text(170, y2, "Cheques", 10); pdf.text(450, y2, "Documentos", 10);
    const cx = [L, 102, 250, 330, 413, 492, R];
    pdf.rect(L, y2 + 4, W, 100); pdf.line(L, y2 + 30, R, y2 + 30); pdf.line(L, y2 + 84, R, y2 + 84);
    for (const x of cx.slice(1, -1)) pdf.line(x, y2 + 4, x, y2 + 84);
    ["Nro. Cheque", "Banco", "Fecha", "Importe", "Fecha Vto", "Importe"].forEach((t, i) => pdf.textCenter((cx[i] + cx[i + 1]) / 2, y2 + 20, t, 10));
    pdf.textRight(cx[4] - 6, y2 + 97, "0.00", 10); pdf.textRight(R - 6, y2 + 97, "0.00", 10);

    // ── Cuenta
    y2 += 116;
    const kx = [L, 128, 430, R];
    pdf.rect(L, y2, W, 72); pdf.line(L, y2 + 22, R, y2 + 22);
    for (const x of kx.slice(1, -1)) pdf.line(x, y2, x, y2 + 72);
    pdf.textCenter((kx[0] + kx[1]) / 2, y2 + 15, "Cuenta", 10); pdf.textCenter((kx[1] + kx[2]) / 2, y2 + 15, "Descripción", 10); pdf.textCenter((kx[2] + kx[3]) / 2, y2 + 15, "Importe", 10);
    pdf.text(L + 8, y2 + 37, op.cuenta_codigo || "", 10);
    pdf.text(kx[1] + 16, y2 + 37, (op.cuenta_nombre || op.banco_nombre || "").slice(0, 40), 10);
    pdf.textRight(R - 22, y2 + 37, fmtTango(neto), 10);
    if (op.banco_fecha) pdf.text(kx[1] + 16, y2 + 51, `Transferencia del ${fmtFecha(op.banco_fecha)}`, 8);

    // ── Totales
    y2 += 84;
    pdf.rect(L, y2, W, 50); pdf.line(300, y2, 300, y2 + 50);
    const retGan = rets.filter(r => r.tipo === "ganancias").map(r => r.certificado_numero).filter(Boolean).join(", ");
    const retIIBB = rets.filter(r => r.tipo === "iibb").map(r => r.certificado_numero).filter(Boolean).join(", ");
    pdf.text(L + 8, y2 + 14, `Imp.Gan.: ${retGan}`.slice(0, 44), 10);
    pdf.text(L + 8, y2 + 26, `Ing.Brutos: ${retIIBB}`.slice(0, 44), 10);
    pdf.text(L + 8, y2 + 38, "CUIT:", 10);
    pdf.text(310, y2 + 26, `TOTAL ORDEN DE PAGO:   ${fmtTango(neto)}`, 10);

    // ── Moneda y son
    y2 += 62;
    pdf.rect(L, y2, W, 62);
    pdf.text(L + 22, y2 + 16, "EMITIDA EN : MONEDA CORRIENTE", 10);
    pdf.text(330, y2 + 16, "COTIZACION:      1.0000", 10);
    const son = `SON : ${numeroALetras(neto)}`;
    const partes: string[] = []; let linea = "";
    for (const w of son.split(" ")) { if ((linea + " " + w).trim().length > 72) { partes.push(linea.trim()); linea = "      " + w; } else linea += " " + w; }
    partes.push(linea.trim() ? linea.replace(/^\s/, "") : "");
    partes.forEach((p, i) => pdf.text(L + 22, y2 + 34 + i * 12, (i ? "      " : "") + p.trim(), 10));

    if (op.observaciones) pdf.text(L, y2 + 80, `Observaciones: ${String(op.observaciones).slice(0, 80)}`, 8);

    // ── Firma
    const yFirma = y2 + 108;
    pdf.line(300, yFirma, 580, yFirma);
    pdf.textCenter(440, yFirma + 12, firmante, 9);
    pdf.textCenter(440, yFirma + 23, cargo, 9);
  }

  const buf = pdf.build();
  const nombre = tipo === "retencion" ? `${nombreArchivo} - Retención.pdf` : `${nombreArchivo}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.nextUrl.searchParams.get("descargar") ? "attachment" : "inline"}; filename="${nombre.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
    },
  });
}
