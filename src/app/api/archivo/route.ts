import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

// Sirve archivos de respaldo guardados dentro de la carpeta datos/ del proyecto (rendiciones, acuerdos, etc.)
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return new NextResponse("No autorizado", { status: 401 });
  const rel = (req.nextUrl.searchParams.get("path") || "").replace(/\\/g, "/");
  const base = path.join(process.cwd(), "datos");
  const full = path.normalize(path.join(process.cwd(), rel));
  if (!full.startsWith(base + path.sep)) return new NextResponse("Acceso denegado", { status: 403 });
  if (!fs.existsSync(full)) return new NextResponse("Archivo no encontrado", { status: 404 });
  const ext = path.extname(full).toLowerCase();
  return new NextResponse(fs.readFileSync(full), {
    headers: {
      "Content-Type": TYPES[ext] || "application/octet-stream",
      "Content-Disposition": `${ext === ".pdf" || ext.startsWith(".j") || ext === ".png" ? "inline" : "attachment"}; filename="${encodeURIComponent(path.basename(full))}"`,
    },
  });
}
