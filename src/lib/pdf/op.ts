/**
 * ContaFlow — PDF de Orden de Pago
 */
import { ContaFlowPDF, EmpresaInfo, AZUL, VERDE, ROJO, GRIS, GRIS_L, NEGRO, BLANCO, CONTENT_W,
         MARGIN_L, MARGIN_R, A4_H, fmtMoneda, fmtFecha, truncar } from "./base";
import { rgb } from "pdf-lib";
import { numeroALetras } from "@/lib/pdf-simple";

interface ItemOP {
  tipo_comprobante: string;
  punto_venta?: string | number;
  numero: string | number;
  fecha_emision: string;
  fecha_vencimiento: string;
  importe: number;
  importe_total: number;
  descripcion?: string;
}

interface RetencionOP {
  tipo: string;
  descripcion: string;
  codigo_regimen: string;
  base_calculo: number;
  alicuota: number;
  importe: number;
  certificado_numero?: string;
}

interface OrdenPago {
  id: number;
  numero: string;
  op_nro_tango?: string;
  fecha: string;
  proveedor: string;
  cuit: string;
  codigo_proveedor?: string;
  cbu?: string;
  direccion?: string;
  importe_bruto: number;
  total_retenciones: number;
  importe_neto: number;
  banco_nombre?: string;
  cuenta_nombre?: string;
  cuenta_codigo?: string;
  banco_fecha?: string;
  observaciones?: string;
}

export async function generarPdfOP(
  op: OrdenPago,
  items: ItemOP[],
  rets: RetencionOP[],
  empresa: EmpresaInfo,
): Promise<Uint8Array> {
  const pdf = new ContaFlowPDF();
  await pdf.init();
  const page = pdf.addPage();
  const { font, fontB } = pdf;

  const subtitulo = op.op_nro_tango ? `OP Tango: ${op.op_nro_tango}` : undefined;
  let y = pdf.drawHeader(page, empresa, "ORDEN DE PAGO", subtitulo);

  // ── Número de OP destacado ──────────────────────────────────────────────────
  page.drawRectangle({ x: MARGIN_L, y: y - 28, width: CONTENT_W, height: 28, color: rgb(0.93, 0.95, 0.98) });
  page.drawText("N° ORDEN DE PAGO", { x: MARGIN_L + 8, y: y - 10, size: 7.5, font: fontB, color: GRIS });
  page.drawText(op.numero, { x: MARGIN_L + 8, y: y - 22, size: 13, font: fontB, color: AZUL });
  const fechaW = fontB.widthOfTextAtSize("FECHA", 7.5);
  page.drawText("FECHA", { x: MARGIN_R - 120, y: y - 10, size: 7.5, font: fontB, color: GRIS });
  page.drawText(fmtFecha(op.fecha), { x: MARGIN_R - 120, y: y - 22, size: 11, font: fontB, color: NEGRO });
  y -= 36;

  // ── Datos del proveedor ──────────────────────────────────────────────────────
  y = pdf.drawSectionLabel(page, y, "Proveedor");
  y -= 4;
  const col2x = MARGIN_L + CONTENT_W / 2 + 10;
  y = pdf.drawKV(page, MARGIN_L, y, "Razón Social:", truncar(op.proveedor, font, 8.5, 230), 85);
  const yAntesProveedor = y + 13;
  pdf.drawKV(page, col2x, yAntesProveedor, "CUIT:", op.cuit || "—", 55);
  y = pdf.drawKV(page, MARGIN_L, y, "Código:", op.codigo_proveedor || "—", 85);
  pdf.drawKV(page, col2x, y + 13, "CBU:", op.cbu || "—", 55);
  y = pdf.drawKV(page, MARGIN_L, y, "Domicilio:", truncar(op.direccion || "—", font, 8.5, 230), 85);
  y -= 6;

  // ── Facturas imputadas ───────────────────────────────────────────────────────
  y = pdf.drawSectionLabel(page, y, "Comprobantes imputados");
  const COL_TIPO  = { x: MARGIN_L,       w: 95,  label: "TIPO",        align: "left"   as const };
  const COL_NRO   = { x: MARGIN_L + 95,  w: 120, label: "NÚMERO",      align: "left"   as const };
  const COL_FEMIS = { x: MARGIN_L + 215, w: 80,  label: "F. EMISIÓN",  align: "center" as const };
  const COL_FVTO  = { x: MARGIN_L + 295, w: 80,  label: "VENCIMIENTO", align: "center" as const };
  const COL_IMP   = { x: MARGIN_L + 375, w: CONTENT_W - 375, label: "IMPORTE", align: "right" as const };
  y = pdf.drawTableHeader(page, y, 18, [COL_TIPO, COL_NRO, COL_FEMIS, COL_FVTO, COL_IMP]);

  const fmtNro = (item: ItemOP) => {
    if (!item.numero) return item.descripcion || "";
    const letra = ((item.tipo_comprobante || "").match(/\s([ABCEM])$/)?.[1] || "");
    const pv = String(item.punto_venta || "").padStart(4, "0");
    const nro = String(item.numero).padStart(8, "0");
    return letra ? `${letra} ${pv}-${nro}` : String(item.numero);
  };

  let totalItems = 0;
  items.forEach((it, i) => {
    const imp = Number(it.importe) || Number(it.importe_total) || 0;
    const esNC = String(it.tipo_comprobante || "").startsWith("Nota de Cr");
    const signo = esNC ? -Math.abs(imp) : imp;
    totalItems += signo;
    const bg = i % 2 === 1 ? GRIS_L : undefined;
    pdf.drawTableRow(page, y, 16, [
      { x: COL_TIPO.x,  w: COL_TIPO.w,  text: truncar(it.tipo_comprobante || "", font, 8, 90) },
      { x: COL_NRO.x,   w: COL_NRO.w,   text: fmtNro(it) },
      { x: COL_FEMIS.x, w: COL_FEMIS.w, text: fmtFecha(it.fecha_emision), align: "center" },
      { x: COL_FVTO.x,  w: COL_FVTO.w,  text: fmtFecha(it.fecha_vencimiento), align: "center" },
      { x: COL_IMP.x,   w: COL_IMP.w,   text: fmtMoneda(signo), align: "right",
        color: esNC ? ROJO : NEGRO },
    ], bg);
    y -= 16;
  });
  // Línea de cierre
  page.drawLine({ start: { x: MARGIN_L, y }, end: { x: MARGIN_R, y }, thickness: 0.5, color: GRIS });
  y -= 10;

  // ── Totales parciales ─────────────────────────────────────────────────────
  const totalBruto = Number(op.importe_bruto) || totalItems;
  y = pdf.drawResumenRow(page, y, "Subtotal bruto", fmtMoneda(totalBruto), 16);

  // ── Retenciones ─────────────────────────────────────────────────────────────
  if (rets.length > 0) {
    y -= 6;
    y = pdf.drawSectionLabel(page, y, "Retenciones");
    const RC_DESC = { x: MARGIN_L,       w: 160, label: "CONCEPTO",          align: "left"   as const };
    const RC_REG  = { x: MARGIN_L + 160, w: 55,  label: "CÓD. RÉGIMEN",      align: "center" as const };
    const RC_CERT = { x: MARGIN_L + 215, w: 80,  label: "Nº CERTIFICADO",    align: "center" as const };
    const RC_BASE = { x: MARGIN_L + 295, w: 90,  label: "BASE",              align: "right"  as const };
    const RC_ALIC = { x: MARGIN_L + 385, w: 50,  label: "ALÍC.",             align: "right"  as const };
    const RC_IMP  = { x: MARGIN_L + 435, w: CONTENT_W - 435, label: "IMPORTE", align: "right" as const };
    y = pdf.drawTableHeader(page, y, 18, [RC_DESC, RC_REG, RC_CERT, RC_BASE, RC_ALIC, RC_IMP]);
    rets.forEach((r, i) => {
      const bg = i % 2 === 1 ? GRIS_L : undefined;
      pdf.drawTableRow(page, y, 15, [
        { x: RC_DESC.x, w: RC_DESC.w, text: truncar(r.descripcion || r.tipo, font, 8, 155) },
        { x: RC_REG.x,  w: RC_REG.w,  text: r.codigo_regimen || "—", align: "center" },
        { x: RC_CERT.x, w: RC_CERT.w, text: r.certificado_numero || "—", align: "center" },
        { x: RC_BASE.x, w: RC_BASE.w, text: fmtMoneda(r.base_calculo), align: "right" },
        { x: RC_ALIC.x, w: RC_ALIC.w, text: `${(Number(r.alicuota) * 100).toFixed(2)} %`, align: "right" },
        { x: RC_IMP.x,  w: RC_IMP.w,  text: fmtMoneda(r.importe), align: "right", color: ROJO },
      ], bg);
      y -= 15;
    });
    page.drawLine({ start: { x: MARGIN_L, y }, end: { x: MARGIN_R, y }, thickness: 0.5, color: GRIS });
    y -= 10;
  }

  // ── Resumen final ────────────────────────────────────────────────────────────
  const neto = Number(op.importe_neto);
  const totalRet = Number(op.total_retenciones);
  y -= 4;
  y = pdf.drawResumenRow(page, y, "Total bruto",     fmtMoneda(totalBruto), 16);
  if (totalRet > 0) {
    y = pdf.drawResumenRow(page, y, `Retenciones (${rets.length})`, `- ${fmtMoneda(totalRet)}`, 16, false, rgb(0.99, 0.95, 0.94));
  }
  y = pdf.drawResumenRow(page, y, "NETO A TRANSFERIR", fmtMoneda(neto), 24, true, rgb(0.90, 0.95, 0.91));
  y -= 8;

  // ── Cuenta bancaria ──────────────────────────────────────────────────────────
  if (op.banco_nombre || op.cuenta_nombre) {
    y = pdf.drawSectionLabel(page, y, "Cuenta de salida");
    y -= 4;
    y = pdf.drawKV(page, MARGIN_L, y, "Banco:", op.banco_nombre || op.cuenta_nombre || "—", 90);
    if (op.banco_fecha) y = pdf.drawKV(page, MARGIN_L, y, "Fecha transferencia:", fmtFecha(op.banco_fecha), 130);
    y -= 4;
  }

  // ── Neto en letras ───────────────────────────────────────────────────────────
  y -= 4;
  page.drawRectangle({ x: MARGIN_L, y: y - 24, width: CONTENT_W, height: 24, color: GRIS_L });
  page.drawText("SON:", { x: MARGIN_L + 8, y: y - 8, size: 7.5, font: fontB, color: GRIS });
  const sonTexto = numeroALetras(neto);
  const maxW = CONTENT_W - 50;
  const sonTrunc = truncar(sonTexto, font, 8.5, maxW);
  page.drawText(sonTrunc, { x: MARGIN_L + 36, y: y - 8, size: 8.5, font, color: NEGRO });
  y -= 32;

  // ── Firma ────────────────────────────────────────────────────────────────────
  if (y > 100) {
    const lineY = Math.min(y - 20, 150);
    page.drawLine({ start: { x: MARGIN_R - 160, y: lineY }, end: { x: MARGIN_R, y: lineY }, thickness: 0.5, color: NEGRO });
    const fnW = font.widthOfTextAtSize(empresa.firmante, 8.5);
    page.drawText(empresa.firmante, { x: MARGIN_R - fnW, y: lineY - 12, size: 8.5, font, color: NEGRO });
    const cgW = font.widthOfTextAtSize(empresa.cargo, 7.5);
    page.drawText(empresa.cargo, { x: MARGIN_R - cgW, y: lineY - 22, size: 7.5, font, color: GRIS });
  }

  // ── Observaciones ────────────────────────────────────────────────────────────
  if (op.observaciones) {
    page.drawText(`Obs: ${truncar(op.observaciones, font, 7.5, CONTENT_W - 30)}`, {
      x: MARGIN_L, y: 55, size: 7.5, font, color: GRIS,
    });
  }

  return pdf.build();
}
