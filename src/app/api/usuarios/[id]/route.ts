// PUT /api/usuarios/[id] — actualizar (desactivar o resetear contraseña)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { action, nueva_password, activo } = body;

    if (action === "toggle_activo") {
      await db.run(
        `UPDATE usuarios SET activo = ? WHERE id = ?`,
        [activo ? 1 : 0, params.id]
      );
      return NextResponse.json({ ok: true });
    }

    if (action === "reset_password") {
      if (!nueva_password || nueva_password.length < 6) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
      }
      const hash = await bcrypt.hash(nueva_password, 12);
      await db.run(`UPDATE usuarios SET password_hash = ? WHERE id = ?`, [hash, params.id]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
