/**
 * API del portal de proveedores.
 * SEGURIDAD: el proveedor_id se toma SIEMPRE de la sesión del servidor,
 * nunca de parámetros enviados por el cliente.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import fs from "fs";
import path from "path";
import { procesarIngesta } from "@/lib/ingesta";

// GET — listar MIS facturas
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "proveedor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const proveedor_id = (session.user as any).proveedor_id;
  if (!proveedor_id) return NextResponse.json({ error: "Sin proveedor asignado" }, { status: 400 });

  // ⚠️ Filtramos SIEMPRE por proveedor_id de la sesión
  const facturas = await db.all(
    `SELECT id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento,
            importe_neto, tipo_iva, importe_iva, importe_total,
            concepto, estado, pdf_path, comentario_admin, cargada_por_proveedor, created_at,
            fecha_pago, numero_op, comprobante_pago_path, certificado_retencion_path, motivo_revision
     FROM facturas_recibidas
     WHERE proveedor_id = ?
     ORDER BY created_at DESC`,
    [proveedor_id]
  );

  return NextResponse.json(facturas);
}

// POST — cargar nueva factura (usa el servicio de ingesta con los mismos controles)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "proveedor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const proveedor_id = (session.user as any).proveedor_id;
  if (!proveedor_id) return NextResponse.json({ error: "Sin proveedor asignado" }, { status: 400 });

  try {
    const formData = await req.formData();

    const tipo_comprobante = String(formData.get("tipo_comprobante") || "A");
    const numero = String(formData.get("numero") || "");
    const fecha_emision = String(formData.get("fecha_emision") || "");
    const fecha_vencimiento = String(formData.get("fecha_vencimiento") || "");
    const importe_neto = parseFloat(String(formData.get("importe_neto") || "0"));
    const tipo_iva = String(formData.get("tipo_iva") || "21%");
    const importe_iva = parseFloat(String(formData.get("importe_iva") || "0"));
    const importe_total = parseFloat(String(formData.get("importe_total") || "0"));
    const concepto = String(formData.get("concepto") || "");
    const pdfFile = formData.get("pdf") as File | null;

    if (!numero || !fecha_emision || !fecha_vencimiento) {
      return NextResponse.json({ error: "Número y fechas son obligatorios" }, { status: 400 });
    }
    if (!pdfFile || pdfFile.type !== "application/pdf") {
      return NextResponse.json({ error: "El PDF es obligatorio para cargar una factura" }, { status: 400 });
    }

    // Obtener CUIT del proveedor para el nombre del archivo y el servicio de ingesta
    const proveedor = await db.get(`SELECT cuit, razon_social FROM proveedores WHERE id = ?`, [proveedor_id]);
    const cuitNorm = String(proveedor?.cuit || "").replace(/-/g, "");
    const numeroNorm = numero.replace(/\//g, "-");
    const pdfFilename = `${cuitNorm}_portal_${tipo_comprobante}_${numeroNorm}.pdf`;
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());

    // Determinar alícuota de IVA para el servicio
    const ivaDetalleItem = tipo_iva === "exento" || tipo_iva === "no_gravado"
      ? []
      : [{ alicuota: tipo_iva, importe: importe_iva }];

    const resultado = await procesarIngesta({
      tipo_operacion: "compra",
      cuit_emisor: proveedor?.cuit || "",
      tipo_comprobante,
      numero,
      fecha_emision,
      fecha_vencimiento,
      neto_gravado: tipo_iva === "no_gravado" ? 0 : importe_neto,
      neto_no_gravado: tipo_iva === "no_gravado" ? importe_neto : 0,
      iva_detalle: ivaDetalleItem,
      total: importe_total,
      concepto,
      origen: "portal",
      confianza_extraccion: 1,
      pdfBuffer,
      pdfFilename,
      override_proveedor_id: Number(proveedor_id),
      cargada_por_proveedor: true,
    });

    if (resultado.estado === "error") {
      return NextResponse.json({ error: resultado.motivo || "Error al procesar la factura" }, { status: 500 });
    }
    if (resultado.estado === "duplicado") {
      return NextResponse.json({ error: "Esta factura ya fue cargada anteriormente" }, { status: 409 });
    }

    return NextResponse.json({ id: resultado.id, estado: resultado.estado }, { status: 201 });
  } catch (error) {
    console.error("Portal factura upload error:", error);
    return NextResponse.json({ error: "Error al procesar la factura" }, { status: 500 });
  }
}
