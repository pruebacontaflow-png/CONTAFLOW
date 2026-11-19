import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  try {
    const lote = await db.get(`SELECT * FROM lotes_pago WHERE id = ?`, [params.id]);
    if (!lote) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const items = await db.all(
      `SELECT lpi.*,
              COALESCE(fr.numero, '') AS numero,
              COALESCE(fr.tipo_comprobante, lpi.comprobante) AS tipo_comprobante,
              COALESCE(p.razon_social, lpi.proveedor) AS proveedor_nombre,
              op.numero AS op_numero
       FROM lotes_pago_items lpi
       LEFT JOIN facturas_recibidas fr ON fr.id = lpi.factura_id
       LEFT JOIN proveedores p ON p.id = fr.proveedor_id
       LEFT JOIN ordenes_pago op ON op.id = lpi.op_id
       WHERE lpi.lote_id = ?`,
      [params.id]
    );
    return NextResponse.json({ ...lote, items });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    const { estado } = await req.json();
    await db.run(`UPDATE lotes_pago SET estado = ? WHERE id = ?`, [estado, params.id]);

    // Al ejecutar: generar OP por ítem y vincular factura pagada
    if (estado === "ejecutado") {
      const lote: any = await db.get(`SELECT * FROM lotes_pago WHERE id = ?`, [params.id]);
      const items: any[] = await db.all(
        `SELECT * FROM lotes_pago_items WHERE lote_id = ? AND op_id IS NULL`,
        [params.id]
      );
      const fechaPago = lote?.fecha_pago || lote?.fecha || new Date().toISOString().split("T")[0];
      const year = new Date(fechaPago).getFullYear();

      for (const item of items) {
        // Próximo número OP YYYY-NNNN
        const prefix = `OP ${year}-`;
        const existing: any[] = await db.all(
          `SELECT numero FROM ordenes_pago WHERE numero LIKE ?`, [`${prefix}%`]
        );
        const nums = existing
          .map((r: any) => parseInt(String(r.numero).replace(prefix, ""), 10))
          .filter((n: number) => !isNaN(n));
        const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        const numero = `${prefix}${String(next).padStart(4, "0")}`;

        const opRes: any = await db.run(
          `INSERT INTO ordenes_pago
             (numero, fecha, nombre_en_banco, cuit_proveedor, importe_bruto, total_retenciones,
              importe_neto, estado, concepto, origen)
           VALUES (?,?,?,?,?,0,?,?,?,?)`,
          [
            numero,
            fechaPago,
            item.proveedor || "",
            item.cuit || "",
            Number(item.importe),
            Number(item.importe),
            "pagado",
            item.descripcion || `Lote ${lote?.nombre}`,
            "lote_pago",
          ]
        );
        const opId = Number(opRes.lastInsertRowid);

        await db.run(`UPDATE lotes_pago_items SET op_id = ? WHERE id = ?`, [opId, item.id]);

        // Marcar factura como pagada
        if (item.factura_id) {
          await db.run(
            `UPDATE facturas_recibidas SET estado = 'pagada', estado_pago = 'pagado',
               fecha_pago = ?, numero_op = ? WHERE id = ?`,
            [fechaPago, numero, item.factura_id]
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  try {
    await db.run(`DELETE FROM lotes_pago_items WHERE lote_id = ?`, [params.id]);
    await db.run(`DELETE FROM lotes_pago WHERE id = ?`, [params.id]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
