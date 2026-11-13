/**
 * Extracción de datos de facturas desde PDFs usando Claude AI.
 * Requiere ANTHROPIC_API_KEY en .env.local.
 */
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface FacturaDatosExtraidos {
  tipo_comprobante: string;   // "A", "B", "C", "E", "M"
  punto_venta: string;
  numero: string;
  fecha_emision: string;      // YYYY-MM-DD
  fecha_vencimiento?: string; // YYYY-MM-DD
  cuit_emisor: string;
  razon_social_emisor: string;
  condicion_iva_emisor?: string;
  cuit_receptor: string;
  razon_social_receptor: string;
  neto_gravado: number;
  neto_no_gravado: number;
  exento: number;
  iva_21: number;
  iva_10_5: number;
  iva_27: number;
  percepcion_iva: number;
  percepcion_iibb: number;
  percepcion_otras: number;
  total: number;
  moneda: string;             // "ARS", "USD"
  tipo_cambio: number;
  cae: string;
  vencimiento_cae: string;
  confianza: number;          // 0-1 estimado por el modelo
}

const SYSTEM_PROMPT = `Sos un experto en facturas argentinas (AFIP/ARCA).
Tu tarea es extraer datos de una factura electrónica argentina en formato PDF y devolver un JSON válido.
Devolvé SOLO el JSON, sin texto adicional, sin markdown, sin explicaciones.
Si un campo no está presente o no es legible, usá "" para strings y 0 para números.
El campo "confianza" va de 0 a 1 (1 = todos los campos leídos con certeza).
Para tipo_comprobante usá solo la letra: "A", "B", "C", "E", "M".
Las fechas van en formato YYYY-MM-DD.
El CUIT va sin guiones.
Los importes van como número (sin símbolo de moneda ni separadores de miles).`;

const SCHEMA_EXAMPLE = `{
  "tipo_comprobante": "A",
  "punto_venta": "00001",
  "numero": "00000123",
  "fecha_emision": "2025-06-15",
  "fecha_vencimiento": "2025-07-15",
  "cuit_emisor": "20123456789",
  "razon_social_emisor": "Proveedor SA",
  "condicion_iva_emisor": "Responsable Inscripto",
  "cuit_receptor": "30714759724",
  "razon_social_receptor": "IT Click Video SA",
  "neto_gravado": 10000.00,
  "neto_no_gravado": 0,
  "exento": 0,
  "iva_21": 2100.00,
  "iva_10_5": 0,
  "iva_27": 0,
  "percepcion_iva": 0,
  "percepcion_iibb": 150.00,
  "percepcion_otras": 0,
  "total": 12250.00,
  "moneda": "ARS",
  "tipo_cambio": 1,
  "cae": "12345678901234",
  "vencimiento_cae": "2025-06-25",
  "confianza": 0.95
}`;

export async function extractFromPdf(pdfBuffer: Buffer): Promise<FacturaDatosExtraidos> {
  const base64Pdf = pdfBuffer.toString("base64");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            type: "text",
            text: `Extraé los datos de esta factura argentina y devolvé SOLO un JSON con esta estructura:\n${SCHEMA_EXAMPLE}`,
          },
        ],
      },
    ],
  });

  const text = message.content.find(b => b.type === "text")?.text || "{}";

  // Limpiar cualquier markdown que el modelo pueda haber agregado
  const jsonStr = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      tipo_comprobante: String(parsed.tipo_comprobante || "A"),
      punto_venta:      String(parsed.punto_venta || ""),
      numero:           String(parsed.numero || ""),
      fecha_emision:    String(parsed.fecha_emision || ""),
      fecha_vencimiento: parsed.fecha_vencimiento ? String(parsed.fecha_vencimiento) : undefined,
      cuit_emisor:      String(parsed.cuit_emisor || "").replace(/-/g, ""),
      razon_social_emisor: String(parsed.razon_social_emisor || ""),
      condicion_iva_emisor: parsed.condicion_iva_emisor ? String(parsed.condicion_iva_emisor) : undefined,
      cuit_receptor:    String(parsed.cuit_receptor || "").replace(/-/g, ""),
      razon_social_receptor: String(parsed.razon_social_receptor || ""),
      neto_gravado:     Number(parsed.neto_gravado) || 0,
      neto_no_gravado:  Number(parsed.neto_no_gravado) || 0,
      exento:           Number(parsed.exento) || 0,
      iva_21:           Number(parsed.iva_21) || 0,
      iva_10_5:         Number(parsed.iva_10_5) || 0,
      iva_27:           Number(parsed.iva_27) || 0,
      percepcion_iva:   Number(parsed.percepcion_iva) || 0,
      percepcion_iibb:  Number(parsed.percepcion_iibb) || 0,
      percepcion_otras: Number(parsed.percepcion_otras) || 0,
      total:            Number(parsed.total) || 0,
      moneda:           String(parsed.moneda || "ARS"),
      tipo_cambio:      Number(parsed.tipo_cambio) || 1,
      cae:              String(parsed.cae || ""),
      vencimiento_cae:  String(parsed.vencimiento_cae || ""),
      confianza:        Math.min(1, Math.max(0, Number(parsed.confianza) || 0.5)),
    };
  } catch {
    throw new Error(`No se pudo parsear la respuesta del modelo: ${text.slice(0, 200)}`);
  }
}
