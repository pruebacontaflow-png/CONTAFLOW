/**
 * ContaFlow — Comprobante de Retención
 * Cubre los campos SICORE (RG 2233 y concordantes):
 * agente, sujeto, impuesto, régimen, comprobante, base, alícuota, importe, nº certificado.
 * Se genera en dos copias (original + duplicado) por retención.
 */
import { ContaFlowPDF, EmpresaInfo, AZUL, VERDE, ROJO, GRIS, GRIS_L, NEGRO, BLANCO,
         CONTENT_W, MARGIN_L, MARGIN_R, A4_H, fmtMoneda, fmtFecha, truncar } from "./base";
import { rgb } from "pdf-lib";

interface RetencionData {
  tipo: string;
  descripcion: string;
  codigo_regimen: string;
  base_calculo: number;
  alicuota: number;
  importe: number;
  certificado_numero?: string;
  fecha?: string;
  cuit_retenido?: string;
  retenido?: string;
  comprobante_origen?: string;
  monto_comprobante?: number;
}

export async function generarPdfRetencion(
  op: { id: number; numero: string; op_nro_tango?: string; fecha: string; proveedor: string; cuit: string; direccion?: string },
  rets: RetencionData[],
  empresa: EmpresaInfo,
): Promise<Uint8Array> {
  const pdf = new ContaFlowPDF();
  await pdf.init();
  const { font, fontB } = pdf;

  for (const ret of rets) {
    for (let copia = 0; copia < 2; copia++) {
      const page = pdf.addPage();
      const { height } = page.getSize();
      let y = pdf.drawHeader(page, empresa, "COMPROBANTE DE RETENCIÓN");

      // Copia (original / duplicado) — esquina superior derecha, ya dibujada encima del header
      const copiaLabel = copia === 0 ? "ORIGINAL" : "DUPLICADO";
      const copiaColor = copia === 0 ? VERDE : GRIS;
      page.drawRectangle({ x: MARGIN_R - 72, y: height - 24, width: 72, height: 20, color: copiaColor });
      const cwTxt = fontB.widthOfTextAtSize(copiaLabel, 7.5);
      page.drawText(copiaLabel, { x: MARGIN_R - 72 + (72 - cwTxt) / 2, y: height - 17, size: 7.5, font: fontB, color: BLANCO });

      // ── Datos del certificado ─────────────────────────────────────────────
      page.drawRectangle({ x: MARGIN_L, y: y - 32, width: CONTENT_W, height: 32, color: rgb(0.93, 0.95, 0.98) });
      page.drawText("N° CERTIFICADO", { x: MARGIN_L + 8, y: y - 11, size: 7.5, font: fontB, color: GRIS });
      page.drawText(ret.certificado_numero || "—", { x: MARGIN_L + 8, y: y - 23, size: 13, font: fontB, color: AZUL });
      page.drawText("FECHA", { x: MARGIN_R - 120, y: y - 11, size: 7.5, font: fontB, color: GRIS });
      page.drawText(fmtFecha(ret.fecha || op.fecha), { x: MARGIN_R - 120, y: y - 23, size: 11, font: fontB, color: NEGRO });
      page.drawText("OP N°", { x: MARGIN_L + CONTENT_W / 2, y: y - 11, size: 7.5, font: fontB, color: GRIS });
      page.drawText(op.op_nro_tango || op.numero, { x: MARGIN_L + CONTENT_W / 2, y: y - 23, size: 9, font: font, color: NEGRO });
      y -= 40;

      // ── Agente de retención (la empresa) ─────────────────────────────────
      y = pdf.drawSectionLabel(page, y, "Agente de retención");
      y -= 4;
      y = pdf.drawKV(page, MARGIN_L, y, "Razón Social:", empresa.razonSocial, 90);
      const ya2 = y + 13;
      pdf.drawKV(page, MARGIN_L + CONTENT_W / 2, ya2, "CUIT:", empresa.cuit, 50);
      y = pdf.drawKV(page, MARGIN_L, y, "Domicilio:", `${empresa.domicilio}, ${empresa.localidad}`, 90);
      y -= 8;

      // ── Sujeto retenido (el proveedor) ─────────────────────────────────────
      y = pdf.drawSectionLabel(page, y, "Sujeto retenido");
      y -= 4;
      y = pdf.drawKV(page, MARGIN_L, y, "Razón Social:", truncar(ret.retenido || op.proveedor, font, 8.5, 230), 90);
      const yb2 = y + 13;
      pdf.drawKV(page, MARGIN_L + CONTENT_W / 2, yb2, "CUIT:", ret.cuit_retenido || op.cuit || "—", 50);
      if (op.direccion) y = pdf.drawKV(page, MARGIN_L, y, "Domicilio:", truncar(op.direccion, font, 8.5, 230), 90);
      y -= 8;

      // ── Datos de la retención ─────────────────────────────────────────────
      y = pdf.drawSectionLabel(page, y, "Datos de la retención");
      y -= 4;

      const impuestoLabel = ret.tipo === "ganancias_sicore" || ret.tipo === "ganancias"
        ? "Impuesto a las Ganancias"
        : ret.tipo === "iibb_agip" || ret.tipo === "iibb_arba" || ret.tipo === "iibb"
        ? "Ingresos Brutos"
        : (ret.tipo || "—");

      y = pdf.drawKV(page, MARGIN_L, y, "Impuesto:", impuestoLabel, 110);
      const yc2 = y + 13;
      pdf.drawKV(page, MARGIN_L + CONTENT_W / 2, yc2, "Código de Régimen:", ret.codigo_regimen || "—", 110);
      y = pdf.drawKV(page, MARGIN_L, y, "Concepto:", truncar(ret.descripcion || "—", font, 8.5, 230), 110);
      if (ret.comprobante_origen) {
        y = pdf.drawKV(page, MARGIN_L, y, "Comprobante origen:", truncar(String(ret.comprobante_origen), font, 8.5, 230), 110);
      }
      y -= 8;

      // ── Importes ─────────────────────────────────────────────────────────
      page.drawLine({ start: { x: MARGIN_L, y: y }, end: { x: MARGIN_R, y }, thickness: 0.5, color: GRIS });
      y -= 4;

      const IMP_LABEL_W = 240;
      const IMP_VAL_X   = MARGIN_L + IMP_LABEL_W;
      const IMP_VAL_W   = CONTENT_W - IMP_LABEL_W;

      const drawImpRow = (label: string, value: string, bold = false, bg?: ReturnType<typeof rgb>) => {
        if (bg) page.drawRectangle({ x: MARGIN_L, y: y - 18, width: CONTENT_W, height: 18, color: bg });
        const f = bold ? fontB : font;
        page.drawText(label, { x: MARGIN_L + 8, y: y - 13, size: 9, font: f, color: bold ? NEGRO : GRIS });
        const vw = f.widthOfTextAtSize(value, bold ? 10 : 9);
        page.drawText(value, { x: MARGIN_R - vw - 8, y: y - 13, size: bold ? 10 : 9, font: f, color: bold ? ROJO : NEGRO });
        y -= 18;
      };

      if (ret.monto_comprobante) drawImpRow("Importe del comprobante que origina la retención", fmtMoneda(ret.monto_comprobante));
      drawImpRow("Base de cálculo sujeta a retención", fmtMoneda(ret.base_calculo));
      if (ret.alicuota) drawImpRow(`Alícuota aplicada (${(Number(ret.alicuota) * 100).toFixed(2)} %)`, fmtMoneda(ret.base_calculo * ret.alicuota));
      drawImpRow("IMPORTE RETENIDO", fmtMoneda(ret.importe), true, rgb(0.99, 0.94, 0.93));

      // ── Declaración y firma ───────────────────────────────────────────────
      y -= 16;
      page.drawText("Declaro que los datos consignados son correctos y completos, sin omitir ni falsear dato alguno", {
        x: MARGIN_L, y, size: 7.5, font, color: GRIS,
      });
      y -= 11;
      page.drawText("que deba contener, siendo fiel expresión de la verdad.", {
        x: MARGIN_L, y, size: 7.5, font, color: GRIS,
      });
      y -= 24;

      const lineY = y;
      page.drawLine({ start: { x: MARGIN_R - 160, y: lineY }, end: { x: MARGIN_R, y: lineY }, thickness: 0.5, color: NEGRO });
      const fnW = font.widthOfTextAtSize(empresa.firmante, 8.5);
      page.drawText(empresa.firmante, { x: MARGIN_R - fnW, y: lineY - 12, size: 8.5, font, color: NEGRO });
      const cgW = font.widthOfTextAtSize(empresa.cargo, 7.5);
      page.drawText(empresa.cargo, { x: MARGIN_R - cgW, y: lineY - 22, size: 7.5, font, color: GRIS });
      const empW = fontB.widthOfTextAtSize(empresa.razonSocial, 7.5);
      page.drawText(`Por ${empresa.razonSocial}`, { x: MARGIN_R - empW - 20, y: lineY - 34, size: 7.5, font: fontB, color: GRIS });
    }
  }

  return pdf.build();
}
