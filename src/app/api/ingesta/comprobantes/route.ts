/**
 * POST /api/ingesta/comprobantes
 * Endpoint para n8n (y cualquier sistema externo).
 * Autenticación: header x-api-key = process.env.INGESTA_API_KEY
 */
import { NextRequest, NextResponse } from "next/server";
import { procesarIngesta, type IngestaParams } from "@/lib/ingesta";

export async function POST(req: NextRequest) {
  // Auth por API key
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.INGESTA_API_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    let params: IngestaParams;
    let pdfBuffer: Buffer | undefined;
    let pdfFilename: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      // JSON de metadatos puede venir como campo "data" o campos individuales
      const dataRaw = formData.get("data");
      let meta: Record<string, any> = {};
      if (dataRaw && typeof dataRaw === "string") {
        meta = JSON.parse(dataRaw);
      } else {
        // Campos individuales
        for (const [key, value] of Array.from(formData.entries())) {
          if (typeof value === "string") {
            meta[key] = value;
          }
        }
      }

      // PDF adjunto
      const pdfFile = formData.get("pdf") as File | null;
      if (pdfFile) {
        pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
        const cuit = String(meta.cuit_emisor || meta.cuit_receptor || "").replace(/-/g, "");
        const pv = String(meta.punto_venta || "0000").padStart(4, "0");
        const num = String(meta.numero || "").replace(/\//g, "-");
        const tipo = String(meta.tipo_comprobante || "A");
        pdfFilename = `${cuit}_${pv}_${tipo}_${num}.pdf`;
      }

      params = buildParams(meta, pdfBuffer, pdfFilename);
    } else {
      // JSON puro sin PDF (el PDF puede llegar luego o ya estar en Drive)
      const body = await req.json();
      params = buildParams(body, undefined, undefined);
    }

    const result = await procesarIngesta(params);

    const status = result.estado === "error" ? 500
                 : result.estado === "duplicado" ? 200
                 : 201;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error("Ingesta endpoint error:", err);
    return NextResponse.json({ estado: "error", motivo: String(err) }, { status: 500 });
  }
}

function buildParams(
  meta: Record<string, any>,
  pdfBuffer?: Buffer,
  pdfFilename?: string
): IngestaParams {
  const parseNum = (v: any) => typeof v === "number" ? v : parseFloat(String(v || "0")) || 0;

  // iva_detalle puede llegar como JSON string o array
  let iva_detalle = meta.iva_detalle;
  if (typeof iva_detalle === "string") {
    try { iva_detalle = JSON.parse(iva_detalle); } catch { iva_detalle = []; }
  }

  return {
    tipo_operacion: meta.tipo_operacion as "compra" | "venta",
    cuit_emisor: String(meta.cuit_emisor || ""),
    razon_social_emisor: String(meta.razon_social_emisor || ""),
    cuit_receptor: String(meta.cuit_receptor || ""),
    razon_social_receptor: String(meta.razon_social_receptor || ""),
    tipo_comprobante: String(meta.tipo_comprobante || "A"),
    punto_venta: String(meta.punto_venta || ""),
    numero: String(meta.numero || ""),
    fecha_emision: String(meta.fecha_emision || ""),
    fecha_vencimiento: meta.fecha_vencimiento ? String(meta.fecha_vencimiento) : undefined,
    moneda: String(meta.moneda || "ARS"),
    tipo_cambio: parseNum(meta.tipo_cambio) || 1,
    neto_gravado: parseNum(meta.neto_gravado),
    neto_no_gravado: parseNum(meta.neto_no_gravado),
    exento: parseNum(meta.exento),
    iva_detalle: Array.isArray(iva_detalle) ? iva_detalle : [],
    percepcion_iva: parseNum(meta.percepcion_iva),
    percepcion_iibb: parseNum(meta.percepcion_iibb),
    percepcion_otras: parseNum(meta.percepcion_otras),
    total: parseNum(meta.total),
    cae: String(meta.cae || ""),
    vencimiento_cae: String(meta.vencimiento_cae || ""),
    drive_file_id: String(meta.drive_file_id || ""),
    drive_url: String(meta.drive_url || ""),
    drive_carpeta: String(meta.drive_carpeta || ""),
    confianza_extraccion: parseNum(meta.confianza_extraccion) || 1,
    origen: String(meta.origen || "n8n"),
    concepto: String(meta.concepto || ""),
    pdfBuffer,
    pdfFilename,
  };
}
