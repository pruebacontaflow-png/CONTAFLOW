/**
 * ContaFlow PDF — módulo base
 * Encabezado, pie y utilidades compartidas para todos los documentos.
 * Usa pdf-lib con fuentes estándar (Helvetica/Helvetica-Bold).
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, degrees } from "pdf-lib";

// ── Paleta ContaFlow ──────────────────────────────────────────────────────────
export const AZUL   = rgb(0.094, 0.373, 0.647);  // #185fa5
export const VERDE  = rgb(0.059, 0.431, 0.337);  // #0F6E56
export const ROJO   = rgb(0.600, 0.235, 0.110);  // #993C1D
export const GRIS   = rgb(0.420, 0.447, 0.502);  // #6b7280
export const GRIS_L = rgb(0.953, 0.961, 0.969);  // #f3f4f6
export const NEGRO  = rgb(0.067, 0.082, 0.161);  // #111827
export const BLANCO = rgb(1, 1, 1);

// ── Constantes de página A4 ───────────────────────────────────────────────────
export const A4_W = 595.28;
export const A4_H = 841.89;
export const MARGIN_L = 36;
export const MARGIN_R = A4_W - 36;
export const CONTENT_W = MARGIN_R - MARGIN_L;

// ── Helpers ───────────────────────────────────────────────────────────────────
export const fmtMoneda = (n: number) =>
  "$ " + (Number(n) || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtFecha = (iso: string) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
};

/** Trunca texto para que quepa en ancho `maxW` puntos con la fuente/tamaño dados */
export function truncar(text: string, font: PDFFont, size: number, maxW: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

// ── PDF builder ───────────────────────────────────────────────────────────────
export interface EmpresaInfo {
  razonSocial: string;
  cuit: string;
  domicilio: string;
  localidad: string;
  firmante: string;
  cargo: string;
}

export class ContaFlowPDF {
  doc!: PDFDocument;
  font!: PDFFont;
  fontB!: PDFFont;
  pages: PDFPage[] = [];

  async init() {
    this.doc = await PDFDocument.create();
    this.font  = await this.doc.embedFont(StandardFonts.Helvetica);
    this.fontB = await this.doc.embedFont(StandardFonts.HelveticaBold);
  }

  addPage(): PDFPage {
    const page = this.doc.addPage([A4_W, A4_H]);
    this.pages.push(page);
    return page;
  }

  /** Dibuja el encabezado de la empresa y el título del documento.
   * Retorna la Y disponible después del encabezado. */
  drawHeader(page: PDFPage, empresa: EmpresaInfo, titulo: string, subtitulo?: string): number {
    const { width, height } = page.getSize();

    // Barra azul superior
    page.drawRectangle({
      x: 0, y: height - 68,
      width, height: 68,
      color: AZUL,
    });

    // Nombre empresa — blanco, negrita
    page.drawText(empresa.razonSocial.toUpperCase(), {
      x: MARGIN_L, y: height - 28,
      size: 13, font: this.fontB, color: BLANCO,
    });
    page.drawText(`CUIT ${empresa.cuit}`, {
      x: MARGIN_L, y: height - 44,
      size: 9, font: this.font, color: rgb(0.85, 0.90, 0.96),
    });
    page.drawText(`${empresa.domicilio}  ·  ${empresa.localidad}`, {
      x: MARGIN_L, y: height - 56,
      size: 8, font: this.font, color: rgb(0.78, 0.84, 0.92),
    });

    // Título del documento — a la derecha en blanco
    const tW = this.fontB.widthOfTextAtSize(titulo, 14);
    page.drawText(titulo, {
      x: MARGIN_R - tW, y: height - 32,
      size: 14, font: this.fontB, color: BLANCO,
    });
    if (subtitulo) {
      const sW = this.font.widthOfTextAtSize(subtitulo, 9);
      page.drawText(subtitulo, {
        x: MARGIN_R - sW, y: height - 48,
        size: 9, font: this.font, color: rgb(0.85, 0.90, 0.96),
      });
    }

    // Línea divisoria
    page.drawLine({
      start: { x: MARGIN_L, y: height - 76 },
      end:   { x: MARGIN_R, y: height - 76 },
      thickness: 0.5, color: GRIS,
    });

    return height - 90; // Y disponible
  }

  /** Dibuja el pie de página */
  drawFooter(page: PDFPage, pageNum: number, totalPages: number) {
    const ahora = new Date();
    const fechaHora = `${String(ahora.getDate()).padStart(2,"0")}/${String(ahora.getMonth()+1).padStart(2,"0")}/${ahora.getFullYear()} ${String(ahora.getHours()).padStart(2,"0")}:${String(ahora.getMinutes()).padStart(2,"0")}`;

    page.drawLine({
      start: { x: MARGIN_L, y: 36 },
      end:   { x: MARGIN_R, y: 36 },
      thickness: 0.5, color: GRIS,
    });
    page.drawText(`Generado por ContaFlow  ·  ${fechaHora}`, {
      x: MARGIN_L, y: 24,
      size: 7, font: this.font, color: GRIS,
    });
    const pText = `Pág. ${pageNum} de ${totalPages}`;
    const pW = this.font.widthOfTextAtSize(pText, 7);
    page.drawText(pText, {
      x: MARGIN_R - pW, y: 24,
      size: 7, font: this.font, color: GRIS,
    });
  }

  /** Dibuja una fila de tabla con fondo opcional */
  drawTableRow(
    page: PDFPage,
    y: number,
    rowH: number,
    cols: Array<{ x: number; w: number; text: string; align?: "left" | "right" | "center"; bold?: boolean; size?: number; color?: ReturnType<typeof rgb> }>,
    bg?: ReturnType<typeof rgb>,
  ) {
    if (bg) page.drawRectangle({ x: MARGIN_L, y: y - rowH, width: CONTENT_W, height: rowH, color: bg });
    for (const col of cols) {
      const f = col.bold ? this.fontB : this.font;
      const sz = col.size ?? 8.5;
      const cl = col.color ?? NEGRO;
      const tw = f.widthOfTextAtSize(col.text, sz);
      let tx: number;
      if (col.align === "right") tx = col.x + col.w - tw - 4;
      else if (col.align === "center") tx = col.x + (col.w - tw) / 2;
      else tx = col.x + 4;
      page.drawText(col.text, { x: tx, y: y - rowH + (rowH - sz) / 2 + 1, size: sz, font: f, color: cl });
    }
  }

  /** Cabecera de tabla con fondo azul */
  drawTableHeader(
    page: PDFPage,
    y: number,
    rowH: number,
    cols: Array<{ x: number; w: number; label: string; align?: "left" | "right" | "center" }>,
  ) {
    page.drawRectangle({ x: MARGIN_L, y: y - rowH, width: CONTENT_W, height: rowH, color: AZUL });
    for (const col of cols) {
      const tw = this.fontB.widthOfTextAtSize(col.label, 8);
      let tx: number;
      if (col.align === "right") tx = col.x + col.w - tw - 4;
      else if (col.align === "center") tx = col.x + (col.w - tw) / 2;
      else tx = col.x + 4;
      page.drawText(col.label, { x: tx, y: y - rowH + (rowH - 8) / 2 + 1, size: 8, font: this.fontB, color: BLANCO });
    }
    return y - rowH;
  }

  /** Dibuja un separador de sección con fondo gris claro */
  drawSectionLabel(page: PDFPage, y: number, label: string): number {
    page.drawRectangle({ x: MARGIN_L, y: y - 16, width: CONTENT_W, height: 16, color: GRIS_L });
    page.drawText(label.toUpperCase(), {
      x: MARGIN_L + 6, y: y - 12,
      size: 7.5, font: this.fontB, color: GRIS,
    });
    return y - 16;
  }

  /** Dibuja una línea de datos (label: valor) */
  drawKV(page: PDFPage, x: number, y: number, label: string, value: string, labelW = 100): number {
    page.drawText(label, { x, y, size: 8, font: this.fontB, color: GRIS });
    page.drawText(value, { x: x + labelW, y, size: 8.5, font: this.font, color: NEGRO });
    return y - 13;
  }

  /** Dibuja una caja de resumen con dos columnas (etiqueta / importe) */
  drawResumenRow(page: PDFPage, y: number, label: string, value: string, h = 18, bold = false, bgColor?: ReturnType<typeof rgb>) {
    if (bgColor) page.drawRectangle({ x: MARGIN_L, y: y - h, width: CONTENT_W, height: h, color: bgColor });
    const f = bold ? this.fontB : this.font;
    page.drawText(label, { x: MARGIN_L + 8, y: y - h + (h - 9) / 2 + 1, size: 9, font: f, color: bold ? NEGRO : GRIS });
    const vw = (bold ? this.fontB : this.font).widthOfTextAtSize(value, 10);
    page.drawText(value, { x: MARGIN_R - vw - 8, y: y - h + (h - 10) / 2 + 1, size: 10, font: bold ? this.fontB : this.font, color: bold ? VERDE : NEGRO });
    return y - h;
  }

  async build(): Promise<Uint8Array> {
    const totalPages = this.pages.length;
    this.pages.forEach((p, i) => this.drawFooter(p, i + 1, totalPages));
    return this.doc.save();
  }
}
