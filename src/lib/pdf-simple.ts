// Generador de PDF mínimo, sin dependencias: texto en Courier (fuente estándar de PDF), líneas y rectángulos.
// Coordenadas en puntos, origen arriba a la izquierda (se convierte internamente). Página A4.

export const A4 = { w: 595.28, h: 841.89 };

function esc(t: string) {
  // WinAnsi (Latin-1) con escape de paréntesis y barra
  let out = "";
  for (const ch of t) {
    const c = ch.charCodeAt(0);
    if (ch === "(" || ch === ")" || ch === "\\") out += "\\" + ch;
    else if (c < 32) out += " ";
    else if (c < 128) out += ch;
    else if (c < 256) out += "\\" + c.toString(8).padStart(3, "0");
    else out += "?";
  }
  return out;
}

export class SimplePDF {
  private pages: string[] = [];
  private cur = "";
  constructor() { this.addPage(); }
  addPage() { if (this.cur) this.pages.push(this.cur); this.cur = "0.4 w\n"; }
  text(x: number, y: number, t: string, size = 9, bold = false) {
    this.cur += `BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${(A4.h - y).toFixed(2)} Td (${esc(t)}) Tj ET\n`;
  }
  textRight(xRight: number, y: number, t: string, size = 9, bold = false) {
    this.text(xRight - t.length * size * 0.6, y, t, size, bold); // Courier: ancho fijo 0,6 em
  }
  textCenter(xc: number, y: number, t: string, size = 9, bold = false) {
    this.text(xc - (t.length * size * 0.6) / 2, y, t, size, bold);
  }
  line(x1: number, y1: number, x2: number, y2: number) {
    this.cur += `${x1.toFixed(2)} ${(A4.h - y1).toFixed(2)} m ${x2.toFixed(2)} ${(A4.h - y2).toFixed(2)} l S\n`;
  }
  rect(x: number, y: number, w: number, h: number) {
    this.cur += `${x.toFixed(2)} ${(A4.h - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S\n`;
  }
  build(): Buffer {
    if (this.cur) { this.pages.push(this.cur); this.cur = ""; }
    const objs: string[] = [];
    const n = this.pages.length;
    // 1 catalog, 2 pages, 3 F1, 4 F2, luego por página: page + contents
    objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
    const kids = this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
    objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
    objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`;
    objs[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>`;
    this.pages.forEach((c, i) => {
      const p = 5 + i * 2;
      objs[p] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${p + 1} 0 R >>`;
      objs[p + 1] = `<< /Length ${Buffer.byteLength(c, "latin1")} >>\nstream\n${c}endstream`;
    });
    let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    const offs: number[] = [];
    for (let i = 1; i < objs.length; i++) {
      offs[i] = Buffer.byteLength(out, "latin1");
      out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
    }
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objs.length; i++) out += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}

// Importe con formato del comprobante de Tango: 278,542.00
export const fmtTango = (n: number) =>
  (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const U = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDOS", "VEINTITRES", "VEINTICUATRO", "VEINTICINCO", "VEINTISEIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const D = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const C = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
function hasta999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), r = n % 100;
  let s = C[c];
  if (r) s += (s ? " " : "") + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? " Y " + U[r % 10] : ""));
  return s;
}
export function numeroALetras(valor: number): string {
  const ent = Math.floor(Math.abs(valor) + 1e-9);
  const cent = Math.round((Math.abs(valor) - ent) * 100);
  const mill = Math.floor(ent / 1e6), miles = Math.floor((ent % 1e6) / 1000), resto = ent % 1000;
  const parts: string[] = [];
  if (mill) parts.push(mill === 1 ? "UN MILLON" : hasta999(mill).replace(/UNO$/, "UN") + " MILLONES");
  if (miles) parts.push(miles === 1 ? "MIL" : hasta999(miles).replace(/UNO$/, "UN") + " MIL");
  if (resto) parts.push(hasta999(resto));
  const txt = parts.length ? parts.join(" ") : "CERO";
  return `${txt} CON ${String(cent).padStart(2, "0")}/100`;
}
