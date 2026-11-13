/**
 * GET /api/drive/folders?parent_id=X
 * Lista subcarpetas del Drive (para que el admin elija la carpeta de facturas).
 * POST /api/drive/folders — guarda la carpeta seleccionada.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listFolders, tokenExists } from "@/lib/drive-service";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!tokenExists()) {
    return NextResponse.json({ error: "Drive no conectado" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get("parent_id") || undefined;

  try {
    const folders = await listFolders(parentId);
    return NextResponse.json(folders);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { carpeta_id, carpeta_nombre } = await req.json();
  if (!carpeta_id) return NextResponse.json({ error: "carpeta_id requerida" }, { status: 400 });

  await db.run(
    `INSERT OR REPLACE INTO parametros (clave, valor, descripcion) VALUES ('drive_carpeta_id', ?, 'ID de carpeta de Google Drive para facturas')`,
    [carpeta_id]
  );
  await db.run(
    `INSERT OR REPLACE INTO parametros (clave, valor, descripcion) VALUES ('drive_carpeta_nombre', ?, 'Nombre de carpeta de Google Drive')`,
    [carpeta_nombre || carpeta_id]
  );

  return NextResponse.json({ ok: true });
}
