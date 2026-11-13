import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".heic": "image/heic",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  try {
    // Sanitizar: eliminar .. y rutas absolutas, solo paths relativos dentro de facturas-pdf/
    const joined = params.path.join("/").replace(/\.\./g, "").replace(/^\//, "");
    const filePath = path.join(process.cwd(), "facturas-pdf", joined);

    // Asegurar que el path resuelto queda dentro de facturas-pdf/
    const base = path.join(process.cwd(), "facturas-pdf");
    if (!filePath.startsWith(base + path.sep) && filePath !== base) {
      return new NextResponse("Acceso denegado", { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Archivo no encontrado", { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
    const basename = path.basename(filePath);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(basename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error sirviendo archivo:", error);
    return new NextResponse("Error interno", { status: 500 });
  }
}
