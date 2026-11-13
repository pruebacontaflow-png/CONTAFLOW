/**
 * Servicio unificado de ingesta de comprobantes.
 * Usado por: endpoint n8n (/api/ingesta/comprobantes),
 *            portal de proveedores (/api/portal/facturas),
 *            carga manual futura.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
import db from "@/lib/db";

export interface IvaDetalleItem {
  alicuota: string; // "21%", "10.5%", "2.5%", etc.
  importe: number;
}

export interface IngestaParams {
  tipo_operacion: "compra" | "venta";
  // Emisor (proveedor en compra)
  cuit_emisor?: string;
  razon_social_emisor?: string;
  // Receptor (cliente en venta)
  cuit_receptor?: string;
  razon_social_receptor?: string;
  // Comprobante
  tipo_comprobante: string;
  punto_venta?: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento?: string;
  // Moneda
  moneda?: string;
  tipo_cambio?: number;
  // Importes
  neto_gravado?: number;
  neto_no_gravado?: number;
  exento?: number;
  iva_detalle?: IvaDetalleItem[];
  percepcion_iva?: number;
  percepcion_iibb?: number;
  percepcion_otras?: number;
  total: number;
  // CAE
  cae?: string;
  vencimiento_cae?: string;
  // Drive / origen
  drive_file_id?: string;
  drive_url?: string;
  drive_carpeta?: string;
  confianza_extraccion?: number;
  origen?: string;
  // PDF
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  // Campos extra para compat. con portal proveedor
  concepto?: string;
  // Si se conoce el proveedor_id de antemano (portal), evita la búsqueda por CUIT
  override_proveedor_id?: number;
  cargada_por_proveedor?: boolean;
}

export interface IngestaResult {
  estado: "creado" | "duplicado" | "requiere_revision" | "error";
  id?: string;
  motivo?: string;
}

const PDF_DIR = path.join(process.cwd(), "facturas-pdf");

export async function procesarIngesta(params: IngestaParams): Promise<IngestaResult> {
  try {
    const {
      tipo_operacion,
      cuit_emisor = "",
      razon_social_emisor = "",
      cuit_receptor = "",
      razon_social_receptor = "",
      tipo_comprobante,
      punto_venta = "",
      numero,
      fecha_emision,
      fecha_vencimiento = fecha_emision,
      moneda = "ARS",
      tipo_cambio = 1,
      neto_gravado = 0,
      neto_no_gravado = 0,
      exento = 0,
      iva_detalle = [],
      percepcion_iva = 0,
      percepcion_iibb = 0,
      percepcion_otras = 0,
      total,
      cae = "",
      vencimiento_cae = "",
      drive_file_id = "",
      drive_url = "",
      drive_carpeta = "",
      confianza_extraccion = 1,
      origen = "n8n",
      pdfBuffer,
      pdfFilename,
      concepto = "",
      override_proveedor_id,
      cargada_por_proveedor = false,
    } = params;

    const cuitEmisorNorm = cuit_emisor.replace(/-/g, "");
    const cuitReceptorNorm = cuit_receptor.replace(/-/g, "");
    const ivaTotal = iva_detalle.reduce((s, i) => s + i.importe, 0);

    // 1 — Duplicado por drive_file_id
    if (drive_file_id) {
      const byDrive = tipo_operacion === "compra"
        ? await db.get(`SELECT id FROM facturas_recibidas WHERE drive_file_id = ?`, [drive_file_id])
        : await db.get(`SELECT id FROM facturas_emitidas WHERE drive_file_id = ?`, [drive_file_id]);
      if (byDrive) {
        return { estado: "duplicado", id: String(byDrive.id), motivo: "drive_file_id ya procesado" };
      }
    }

    // 2 — Duplicado por hash del PDF
    let hashPdf = "";
    if (pdfBuffer) {
      hashPdf = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
      const byHash = tipo_operacion === "compra"
        ? await db.get(`SELECT id FROM facturas_recibidas WHERE hash_pdf = ?`, [hashPdf])
        : await db.get(`SELECT id FROM facturas_emitidas WHERE hash_pdf = ?`, [hashPdf]);
      if (byHash) {
        return { estado: "duplicado", id: String(byHash.id), motivo: "PDF ya cargado anteriormente" };
      }
    }

    // 3 — Duplicado por CUIT + tipo + PV + número
    const cuitDup = tipo_operacion === "compra" ? cuitEmisorNorm : cuitReceptorNorm;
    if (cuitDup) {
      const byNumero = tipo_operacion === "compra"
        ? await db.get(
            `SELECT id FROM facturas_recibidas WHERE cuit_emisor = ? AND tipo_comprobante = ? AND punto_venta = ? AND numero = ?`,
            [cuitDup, tipo_comprobante, punto_venta, numero]
          )
        : await db.get(
            `SELECT id FROM facturas_emitidas WHERE cuit_receptor = ? AND tipo_comprobante = ? AND punto_venta = ? AND numero = ?`,
            [cuitDup, tipo_comprobante, punto_venta, numero]
          );
      if (byNumero) {
        return { estado: "duplicado", id: String(byNumero.id), motivo: "Comprobante ya registrado (CUIT + tipo + PV + número)" };
      }
    }

    // 4 — Buscar entidad relacionada
    let entidadId: number | null = override_proveedor_id ?? null;
    let motivoRevision = "";
    let estadoFinal = "pendiente_revision";

    if (entidadId === null) {
      if (tipo_operacion === "compra" && cuitEmisorNorm) {
        const prov = await db.get(`SELECT id FROM proveedores WHERE replace(cuit,'-','') = ?`, [cuitEmisorNorm]);
        if (prov) {
          entidadId = Number(prov.id);
        } else {
          motivoRevision = `CUIT emisor ${cuit_emisor} no registrado (${razon_social_emisor})`;
          estadoFinal = "requiere_revision";
        }
      } else if (tipo_operacion === "venta" && cuitReceptorNorm) {
        const cli = await db.get(`SELECT id FROM clientes WHERE replace(cuit,'-','') = ?`, [cuitReceptorNorm]);
        if (cli) {
          entidadId = Number(cli.id);
        } else {
          motivoRevision = `CUIT receptor ${cuit_receptor} no registrado (${razon_social_receptor})`;
          estadoFinal = "requiere_revision";
        }
      }
    }

    // 5 — Validación aritmética
    if (estadoFinal !== "requiere_revision") {
      const suma = neto_gravado + neto_no_gravado + exento + ivaTotal + percepcion_iva + percepcion_iibb + percepcion_otras;
      if (Math.abs(suma - total) > 1) {
        motivoRevision = `Aritmética no cierra: suma componentes ${suma.toFixed(2)} vs total ${total.toFixed(2)}`;
        estadoFinal = "requiere_revision";
      }
    }

    // 6 — Confianza de extracción
    if (estadoFinal !== "requiere_revision" && confianza_extraccion < 0.85) {
      motivoRevision = `Confianza de extracción baja: ${(confianza_extraccion * 100).toFixed(0)}%`;
      estadoFinal = "requiere_revision";
    }

    // 7 — Guardar PDF
    let pdfPath = "";
    if (pdfBuffer) {
      fs.mkdirSync(PDF_DIR, { recursive: true });
      const fn = pdfFilename || `ingesta-${Date.now()}.pdf`;
      pdfPath = fn;
      fs.writeFileSync(path.join(PDF_DIR, fn), pdfBuffer);
    }

    // 8 — Tipo IVA para compat. con UI existente
    let tipoIvaCompat = "exento";
    if (iva_detalle.length === 1) {
      tipoIvaCompat = iva_detalle[0].alicuota;
    } else if (iva_detalle.length > 1) {
      tipoIvaCompat = "multiple";
    } else if (neto_no_gravado > 0) {
      tipoIvaCompat = "no_gravado";
    }

    // 9 — Insertar y guardar detalle de IVA por alícuota
    const cargadaPorProv = cargada_por_proveedor ? 1 : 0;
    if (tipo_operacion === "compra") {
      const r = await db.run(
        `INSERT INTO facturas_recibidas
           (proveedor_id, tipo_comprobante, punto_venta, numero, fecha_emision, fecha_vencimiento,
            importe_neto, tipo_iva, importe_iva, importe_total, concepto,
            estado, pdf_path, comentario_admin, cargada_por_proveedor,
            neto_gravado, neto_no_gravado, exento,
            percepcion_iva, percepcion_iibb, percepcion_otras,
            moneda, tipo_cambio, cuit_emisor, cae, vencimiento_cae,
            hash_pdf, confianza_extraccion, origen, motivo_revision,
            drive_file_id, drive_url, drive_carpeta)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          entidadId ?? 0, tipo_comprobante, punto_venta, numero, fecha_emision, fecha_vencimiento,
          neto_gravado, tipoIvaCompat, ivaTotal, total, concepto,
          estadoFinal, pdfPath, "", cargadaPorProv,
          neto_gravado, neto_no_gravado, exento,
          percepcion_iva, percepcion_iibb, percepcion_otras,
          moneda, tipo_cambio, cuitEmisorNorm, cae, vencimiento_cae,
          hashPdf, confianza_extraccion, origen, motivoRevision,
          drive_file_id, drive_url, drive_carpeta,
        ]
      );
      const newId = Number(r.lastInsertRowid);
      // Guardar detalle IVA por alícuota
      for (const det of iva_detalle) {
        await db.run(
          `INSERT INTO facturas_iva_detalle (factura_id,tabla,alicuota,base_imponible,importe) VALUES (?,?,?,?,?)`,
          [newId, "recibidas", det.alicuota, neto_gravado, det.importe]
        );
      }
      return { estado: estadoFinal as IngestaResult["estado"], id: String(newId), motivo: motivoRevision || undefined };
    } else {
      const r = await db.run(
        `INSERT INTO facturas_emitidas
           (cliente_id, tipo_comprobante, punto_venta, numero, fecha_emision, fecha_vencimiento,
            importe_neto, tipo_iva, importe_iva, importe_total, concepto,
            estado, pdf_path,
            neto_gravado, neto_no_gravado, exento,
            percepcion_iva, percepcion_iibb, percepcion_otras,
            moneda, tipo_cambio, cuit_receptor, cae, vencimiento_cae,
            hash_pdf, confianza_extraccion, origen, motivo_revision,
            drive_file_id, drive_url, drive_carpeta)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          entidadId ?? 0, tipo_comprobante, punto_venta, numero, fecha_emision, fecha_vencimiento,
          neto_gravado, tipoIvaCompat, ivaTotal, total, concepto,
          estadoFinal, pdfPath,
          neto_gravado, neto_no_gravado, exento,
          percepcion_iva, percepcion_iibb, percepcion_otras,
          moneda, tipo_cambio, cuitReceptorNorm, cae, vencimiento_cae,
          hashPdf, confianza_extraccion, origen, motivoRevision,
          drive_file_id, drive_url, drive_carpeta,
        ]
      );
      const newIdV = Number(r.lastInsertRowid);
      for (const det of iva_detalle) {
        await db.run(
          `INSERT INTO facturas_iva_detalle (factura_id,tabla,alicuota,base_imponible,importe) VALUES (?,?,?,?,?)`,
          [newIdV, "emitidas", det.alicuota, neto_gravado, det.importe]
        );
      }
      return { estado: estadoFinal as IngestaResult["estado"], id: String(newIdV), motivo: motivoRevision || undefined };
    }
  } catch (err) {
    console.error("Ingesta error:", err);
    return { estado: "error", motivo: String(err) };
  }
}
