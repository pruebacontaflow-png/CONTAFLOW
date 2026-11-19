import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { generarPdfOP } from "@/lib/pdf/op";
import { generarPdfRetencion } from "@/lib/pdf/retencion";
import type { EmpresaInfo } from "@/lib/pdf/base";

async function param(clave: string, def: string): Promise<string> {
  const r: any = await db.get(`SELECT valor FROM parametros WHERE clave = ?`, [clave]);
  return r?.valor || def;
}

async function getEmpresa(): Promise<EmpresaInfo> {
  return {
    razonSocial: await param("empresa_razon_social", "IT CLICK VIDEO SA"),
    cuit:        await param("empresa_cuit",         "30-71475972-4"),
    domicilio:   await param("empresa_domicilio",    "Avda. del Libertador 6810-P.18"),
    localidad:   await param("empresa_localidad",    "C.A.B.A."),
    firmante:    await param("empresa_firmante",     "Lucas Jinkis"),
    cargo:       await param("empresa_firmante_cargo","Presidente"),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("No autorizado", { status: 401 });

  const tipo = req.nextUrl.searchParams.get("tipo") || "op";

  const op: any = await db.get(
    `SELECT op.*, COALESCE(p.razon_social, op.nombre_en_banco) AS proveedor,
            COALESCE(p.cuit, op.cuit_proveedor) AS cuit,
            p.direccion, p.codigo_proveedor, p.cbu,
            cb.banco AS banco_nombre, pc.codigo AS cuenta_codigo, pc.nombre AS cuenta_nombre,
            el.fecha AS banco_fecha, el.descripcion AS banco_desc
     FROM ordenes_pago op
     LEFT JOIN proveedores p ON p.id = op.proveedor_id
     LEFT JOIN cuentas_bancarias cb ON cb.id = op.cuenta_bancaria_id
     LEFT JOIN plan_cuentas pc ON pc.id = cb.cuenta_contable_id
     LEFT JOIN extractos_lineas el ON el.id = op.linea_extracto_id
     WHERE op.id = ?`,
    [params.id]
  );
  if (!op) return new NextResponse("Orden de pago no encontrada", { status: 404 });

  const items: any[] = await db.all(
    `SELECT i.importe, i.descripcion, f.tipo_comprobante, f.punto_venta, f.numero,
            f.fecha_vencimiento, f.fecha_emision, f.importe_total
     FROM ordenes_pago_items i
     LEFT JOIN facturas_recibidas f ON f.id = i.factura_id
     WHERE i.orden_pago_id = ? ORDER BY i.id`,
    [op.id]
  );
  const rets: any[] = await db.all(
    `SELECT * FROM retenciones_aplicadas WHERE orden_pago_id = ? ORDER BY id`,
    [op.id]
  );

  // Con ?original=1 → PDF de Tango (respaldo histórico)
  const original = tipo === "retencion"
    ? String(op.tango_ret_paths || "").split(";").filter(Boolean)[0]
    : op.tango_pdf_path;
  if (original && req.nextUrl.searchParams.get("original") === "1") {
    const fs = await import("fs"); const pathMod = await import("path");
    const full = pathMod.join(process.cwd(), original);
    if (fs.existsSync(full)) {
      return new NextResponse(new Uint8Array(fs.readFileSync(full)), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${pathMod.basename(full)}"` },
      });
    }
  }

  const empresa = await getEmpresa();
  const nombreBase = `${op.numero || "OP"} - ${(op.proveedor || "").replace(/[\\/:*?"<>|]/g, "")}`;

  let pdfBytes: Uint8Array;
  let fileName: string;

  if (tipo === "retencion") {
    if (!rets.length) return new NextResponse("Esta orden de pago no tiene retenciones", { status: 404 });
    pdfBytes = await generarPdfRetencion(op, rets, empresa);
    fileName = `${nombreBase} - Retención.pdf`;
  } else {
    pdfBytes = await generarPdfOP(op, items, rets, empresa);
    fileName = `${nombreBase}.pdf`;
  }

  const inline = req.nextUrl.searchParams.get("descargar") ? "attachment" : "inline";
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline}; filename="${fileName.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  });
}
