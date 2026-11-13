/**
 * GET  /api/usuarios       — lista usuarios admin/contador (solo admin)
 * POST /api/usuarios       — crea usuario admin o contador (solo admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const usuarios = await db.all(
    `SELECT id, username, rol, activo, created_at FROM usuarios WHERE rol IN ('admin','contador') ORDER BY created_at DESC`
  );
  return NextResponse.json(usuarios);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { username, password, rol } = await req.json();
    if (!username || !password || !rol) {
      return NextResponse.json({ error: "Usuario, contraseña y rol son obligatorios" }, { status: 400 });
    }
    if (!["admin", "contador"].includes(rol)) {
      return NextResponse.json({ error: "Rol inválido — debe ser 'admin' o 'contador'" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await db.run(
      `INSERT INTO usuarios (username, password_hash, rol, activo) VALUES (?, ?, ?, 1)`,
      [username, hash, rol]
    );
    return NextResponse.json({ id: String(result.lastInsertRowid) }, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE")) {
      return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
