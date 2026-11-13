/**
 * POST /api/drive/sync
 * Inicia sincronización manual con Google Drive.
 * Body JSON: { carpeta_id?, solo_nuevos? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { tokenExists } from "@/lib/drive-service";
import { syncDriveFolder } from "@/lib/drive-sync";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (!tokenExists()) {
    return NextResponse.json({ error: "Google Drive no está conectado" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const { solo_nuevos = true } = body;

  // Leer carpeta desde params (o body si se pasa explícitamente)
  let carpetaId   = body.carpeta_id   || null;
  let carpetaNombre = body.carpeta_nombre || null;

  if (!carpetaId) {
    const p = await db.get(`SELECT valor FROM parametros WHERE clave='drive_carpeta_id'`);
    carpetaId = p?.valor || null;
  }
  if (!carpetaNombre) {
    const p = await db.get(`SELECT valor FROM parametros WHERE clave='drive_carpeta_nombre'`);
    carpetaNombre = p?.valor || null;
  }

  if (!carpetaId) {
    return NextResponse.json({ error: "No hay carpeta de Drive configurada" }, { status: 400 });
  }

  // Si solo_nuevos: buscar desde la última sincronización exitosa
  let sinceMs: number | undefined;
  if (solo_nuevos) {
    const last = await db.get(
      `SELECT fecha FROM drive_sync_log WHERE estado IN ('ok','parcial') ORDER BY id DESC LIMIT 1`
    );
    if (last?.fecha) {
      sinceMs = new Date(String(last.fecha)).getTime() - 60_000; // 1 min de margen
    }
  }

  try {
    const result = await syncDriveFolder({
      folderId:    carpetaId,
      folderName:  carpetaNombre || carpetaId,
      sinceMs,
      iniciado_por: (session.user as any).name || "manual",
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error en sync" }, { status: 500 });
  }
}
