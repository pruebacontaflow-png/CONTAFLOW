/**
 * Descarga segura de comprobante de pago o certificado de retención.
 * Solo el proveedor dueño de la factura puede descargar sus archivos.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "proveedor") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const proveedor_id = (session.user as any).proveedor_id;
  if (!proveedor_id) return NextResponse.json({ error: "Sin proveedor asignado" }, { status: 400 });

  const tipo = req.nextUrl.searchParams.get("tipo"); // "comprobante_pago" | "certificado_retencion"
  if (tipo !== "comprobante_pago" && tipo !== "certificado_retencion") {
    return NextResponse.json({ error: "Tipo inválido. Use comprobante_pago o certificado_retencion" }, { status: 400 });
  }

  // Verificar que la factura pertenece a este proveedor
  const factura = await db.get(
    `SELECT id, comprobante_pago_path, certificado_retencion_path
     FROM facturas_recibidas
     WHERE id = ? AND proveedor_id = ?`,
    [params.id, proveedor_id]
  );

  if (!factura) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
  }

  const filePath: string = tipo === "comprobante_pago"
    ? String(factura.comprobante_pago_path || "")
    : String(factura.certificado_retencion_path || "");

  if (!filePath) {
    return NextResponse.json({ error: "Archivo no disponible" }, { status: 404 });
  }

  // Prevenir path traversal
  const safeFilename = path.basename(filePath);
  const fullPath = path.join(process.cwd(), "facturas-pdf", safeFilename);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "Archivo no encontrado en el servidor" }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(fullPath);
  const isPdf = safeFilename.toLowerCase().endsWith(".pdf");

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": isPdf ? "application/pdf" : "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
  });
}
