/**
 * Lógica de sincronización Drive → ContaFlow.
 * Llamado desde /api/drive/sync y desde scripts/drive-sync.js.
 */
import db from "@/lib/db";
import { listPdfFiles, downloadFile } from "@/lib/drive-service";
import { extractFromPdf } from "@/lib/drive-extractor";
import { procesarIngesta } from "@/lib/ingesta";

interface SyncOptions {
  folderId: string;
  folderName?: string;
  sinceMs?: number;           // solo archivos modificados después de este timestamp
  iniciado_por?: string;
}

interface SyncResult {
  encontrados: number;
  procesados: number;
  duplicados: number;
  errores: number;
  duracion_ms: number;
  detalle: { file: string; estado: string; motivo?: string }[];
}

export async function syncDriveFolder(opts: SyncOptions): Promise<SyncResult> {
  const t0 = Date.now();
  const detalle: SyncResult["detalle"] = [];

  const archivos = await listPdfFiles(opts.folderId, opts.sinceMs);
  let procesados = 0, duplicados = 0, errores = 0;

  for (const file of archivos) {
    try {
      const buffer = await downloadFile(file.id);
      const datos = await extractFromPdf(buffer);

      const ivaDetalle = [];
      if (datos.iva_21    > 0) ivaDetalle.push({ alicuota: "21%",    importe: datos.iva_21 });
      if (datos.iva_10_5  > 0) ivaDetalle.push({ alicuota: "10.5%",  importe: datos.iva_10_5 });
      if (datos.iva_27    > 0) ivaDetalle.push({ alicuota: "27%",     importe: datos.iva_27 });

      const result = await procesarIngesta({
        tipo_operacion:         "compra",
        cuit_emisor:            datos.cuit_emisor,
        razon_social_emisor:    datos.razon_social_emisor,
        cuit_receptor:          datos.cuit_receptor,
        razon_social_receptor:  datos.razon_social_receptor,
        tipo_comprobante:       datos.tipo_comprobante,
        punto_venta:            datos.punto_venta,
        numero:                 datos.numero,
        fecha_emision:          datos.fecha_emision,
        fecha_vencimiento:      datos.fecha_vencimiento,
        moneda:                 datos.moneda,
        tipo_cambio:            datos.tipo_cambio,
        neto_gravado:           datos.neto_gravado,
        neto_no_gravado:        datos.neto_no_gravado,
        exento:                 datos.exento,
        iva_detalle:            ivaDetalle,
        percepcion_iva:         datos.percepcion_iva,
        percepcion_iibb:        datos.percepcion_iibb,
        percepcion_otras:       datos.percepcion_otras,
        total:                  datos.total,
        cae:                    datos.cae,
        vencimiento_cae:        datos.vencimiento_cae,
        drive_file_id:          file.id,
        drive_url:              file.webViewLink || "",
        drive_carpeta:          opts.folderName || opts.folderId,
        confianza_extraccion:   datos.confianza,
        origen:                 "drive",
        pdfBuffer:              buffer,
        pdfFilename:            file.name,
      });

      if (result.estado === "duplicado") {
        duplicados++;
        detalle.push({ file: file.name, estado: "duplicado", motivo: result.motivo });
      } else if (result.estado === "error") {
        errores++;
        detalle.push({ file: file.name, estado: "error", motivo: result.motivo });
      } else {
        procesados++;
        detalle.push({ file: file.name, estado: result.estado });
      }
    } catch (err: any) {
      errores++;
      detalle.push({ file: file.name, estado: "error", motivo: String(err?.message || err) });
    }
  }

  const duracion_ms = Date.now() - t0;

  // Registrar en log
  await db.run(
    `INSERT INTO drive_sync_log
       (carpeta_id, carpeta_nombre, archivos_encontrados, archivos_procesados,
        archivos_duplicados, archivos_error, duracion_ms, estado, detalle, iniciado_por)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      opts.folderId,
      opts.folderName || opts.folderId,
      archivos.length,
      procesados,
      duplicados,
      errores,
      duracion_ms,
      errores > 0 ? "parcial" : "ok",
      JSON.stringify(detalle),
      opts.iniciado_por || "sistema",
    ]
  );

  return { encontrados: archivos.length, procesados, duplicados, errores, duracion_ms, detalle };
}
