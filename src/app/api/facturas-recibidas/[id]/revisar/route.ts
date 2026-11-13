// PUT /api/facturas-recibidas/[id]/revisar
// Solo admin. Aprueba (→ pendiente_pago) u observa (→ observada + comentario)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { checkPeriodoCerrado } from "@/lib/periodos";
import { asientoCompra } from "@/lib/asientos-auto";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const { accion, comentario } = await req.json();

    if (accion === "aprobar") {
      // Verificar que el período de la factura no esté cerrado
      const factura = await db.get(`SELECT fecha_emision FROM facturas_recibidas WHERE id=?`, [params.id]);
      if (factura) {
        const err = await checkPeriodoCerrado(String(factura.fecha_emision));
        if (err) return NextResponse.json({ error: err }, { status: 422 });
      }
      await db.run(
        `UPDATE facturas_recibidas SET estado='pendiente_pago', comentario_admin='' WHERE id=?`,
        [params.id]
      );
      // Asiento automático de compra al aprobar
      asientoCompra(Number(params.id)).catch(e => console.warn("asientoCompra:", e));
      return NextResponse.json({ ok: true, nuevo_estado: "pendiente_pago" });
    }

    if (accion === "observar") {
      if (!comentario?.trim()) {
        return NextResponse.json({ error: "El comentario es obligatorio al observar" }, { status: 400 });
      }
      await db.run(
        `UPDATE facturas_recibidas SET estado='observada', comentario_admin=? WHERE id=?`,
        [comentario.trim(), params.id]
      );
      return NextResponse.json({ ok: true, nuevo_estado: "observada" });
    }

    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
