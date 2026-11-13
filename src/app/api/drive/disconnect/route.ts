/**
 * DELETE /api/drive/disconnect
 * Elimina el token OAuth2 guardado (desconecta la cuenta de Drive).
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteToken } from "@/lib/drive-service";

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    deleteToken();
    return NextResponse.json({ ok: true, mensaje: "Desconectado de Google Drive" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
