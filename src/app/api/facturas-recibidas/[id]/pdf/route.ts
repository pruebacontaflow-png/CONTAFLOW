import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import db from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await req.formData();
    const file = formData.get("pdf") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Se requiere un archivo PDF válido" },
        { status: 400 }
      );
    }

    // Obtener factura + CUIT del proveedor para nombrar el archivo
    const factura = await db.get(
      `SELECT fr.tipo_comprobante, fr.numero, p.cuit
       FROM facturas_recibidas fr
       JOIN proveedores p ON p.id = fr.proveedor_id
       WHERE fr.id = ?`,
      [params.id]
    );

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Generar nombre seguro: A-0001-00001234-30711234567.pdf
    const cuitNorm = String(factura.cuit).replace(/-/g, "");
    const numeroNorm = String(factura.numero).replace(/\//g, "-");
    const filename = `${factura.tipo_comprobante}-${numeroNorm}-${cuitNorm}.pdf`;

    // Guardar archivo
    const dirPath = path.join(process.cwd(), "facturas-pdf");
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);
    const bytes = await file.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(bytes));

    // Actualizar base de datos
    await db.run(
      `UPDATE facturas_recibidas SET pdf_path = ? WHERE id = ?`,
      [filename, params.id]
    );

    return NextResponse.json({ ok: true, filename });
  } catch (error) {
    console.error("Error subiendo PDF:", error);
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const factura = await db.get(
      `SELECT pdf_path FROM facturas_recibidas WHERE id = ?`,
      [params.id]
    );
    if (factura?.pdf_path) {
      const filePath = path.join(process.cwd(), "facturas-pdf", String(factura.pdf_path));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await db.run(`UPDATE facturas_recibidas SET pdf_path = '' WHERE id = ?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}
