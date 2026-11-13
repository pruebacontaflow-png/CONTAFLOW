/**
 * GET /api/drive/status
 * Devuelve estado de la conexión y últimos logs de sync.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { tokenExists, getAuthUrl } from "@/lib/drive-service";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const conectado = tokenExists();
  const authUrl   = conectado ? null : getAuthUrl();

  // Últimos 20 logs
  const logs = await db.all(
    `SELECT id, fecha, carpeta_nombre, archivos_encontrados, archivos_procesados,
            archivos_duplicados, archivos_error, duracion_ms, estado, iniciado_por
     FROM drive_sync_log ORDER BY id DESC LIMIT 20`
  );

  // Configuración guardada (carpeta seleccionada)
  const carpetaParam = await db.get(
    `SELECT valor FROM parametros WHERE clave='drive_carpeta_id'`
  );
  const carpetaNombreParam = await db.get(
    `SELECT valor FROM parametros WHERE clave='drive_carpeta_nombre'`
  );

  return NextResponse.json({
    conectado,
    auth_url: authUrl,
    carpeta_id:     carpetaParam?.valor     || null,
    carpeta_nombre: carpetaNombreParam?.valor || null,
    logs,
  });
}
