/**
 * PUT /api/bandeja/[id]
 * Aprueba, corrige o rechaza un comprobante de la bandeja.
 * Solo admin.
 * body: { accion: "aprobar" | "rechazar", nuevo_estado?, motivo?, form? }
 *
 * El campo "tipo" se autodetecta: si existe en facturas_recibidas es compra, si no en facturas_emitidas.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { asientoCompra } from "@/lib/asientos-auto";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const id = params.id;
  const body = await req.json();
  const { accion, nuevo_estado = "pendiente_pago", motivo, form } = body;

  // Detectar tabla
  const enCompras = await db.get(
    `SELECT id FROM facturas_recibidas WHERE id = ? AND estado IN ('pendiente_revision','requiere_revision')`,
    [id]
  );
  const tabla = enCompras ? "facturas_recibidas" : "facturas_emitidas";

  if (accion === "aprobar") {
    const updates: string[] = [`estado = ?`];
    const args: any[] = [nuevo_estado];

    if (form) {
      // Actualizar los campos editados en el panel
      const p = (v: any) => parseFloat(String(v || "0")) || 0;
      updates.push(
        `tipo_comprobante = ?`, `punto_venta = ?`, `numero = ?`,
        `fecha_emision = ?`, `fecha_vencimiento = ?`,
        `neto_gravado = ?`, `neto_no_gravado = ?`, `exento = ?`,
        `importe_iva = ?`,
        `percepcion_iva = ?`, `percepcion_iibb = ?`, `percepcion_otras = ?`,
        `importe_total = ?`, `moneda = ?`, `tipo_cambio = ?`,
        `cae = ?`, `vencimiento_cae = ?`, `concepto = ?`,
        `motivo_revision = ?`
      );
      args.push(
        form.tipo_comprobante, form.punto_venta || "", form.numero,
        form.fecha_emision, form.fecha_vencimiento,
        p(form.neto_gravado), p(form.neto_no_gravado), p(form.exento),
        p(form.importe_iva),
        p(form.percepcion_iva), p(form.percepcion_iibb), p(form.percepcion_otras),
        p(form.importe_total), form.moneda || "ARS", p(form.tipo_cambio) || 1,
        form.cae || "", form.vencimiento_cae || "", form.concepto || "",
        ""  // limpiar motivo_revision al aprobar
      );

      // Actualizar importe_neto como neto_gravado para compat. con UI
      updates.push(`importe_neto = ?`);
      args.push(p(form.neto_gravado));

      // Si se eligió un proveedor/cliente, actualizar la FK
      if (tabla === "facturas_recibidas" && form.proveedor_id) {
        updates.push(`proveedor_id = ?`);
        args.push(parseInt(form.proveedor_id));
      }
      if (tabla === "facturas_emitidas" && form.cliente_id) {
        updates.push(`cliente_id = ?`);
        args.push(parseInt(form.cliente_id));
      }
    } else {
      updates.push(`motivo_revision = ?`);
      args.push("");
    }

    args.push(id);
    await db.run(`UPDATE ${tabla} SET ${updates.join(", ")} WHERE id = ?`, args);

    // Asiento automático solo para facturas de compra que pasan a pendiente_pago
    if (tabla === "facturas_recibidas" && nuevo_estado === "pendiente_pago") {
      asientoCompra(Number(id)).catch(e => console.warn("asientoCompra:", e));
    }

    return NextResponse.json({ ok: true, nuevo_estado });
  }

  if (accion === "rechazar") {
    if (!motivo?.trim()) {
      return NextResponse.json({ error: "El motivo es obligatorio" }, { status: 400 });
    }
    await db.run(
      `UPDATE ${tabla} SET estado = 'rechazada', motivo_revision = ? WHERE id = ?`,
      [motivo.trim(), id]
    );
    return NextResponse.json({ ok: true, nuevo_estado: "rechazada" });
  }

  return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
}
