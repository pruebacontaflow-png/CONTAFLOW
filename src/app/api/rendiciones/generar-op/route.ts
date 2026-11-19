import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { clave, medio_pago } = await req.json();
  if (!clave) return NextResponse.json({ error: "Falta clave de rendición" }, { status: 400 });

  // Traer todos los items de esta rendición
  const items: any[] = await db.all(
    `SELECT * FROM viaticos WHERE archivo_adjunto = ?`,
    [clave]
  );
  if (!items.length) return NextResponse.json({ error: "Rendición no encontrada" }, { status: 404 });

  // Si ya tiene OP, devolver la existente
  const yaOp = items.find((i: any) => i.op_rendicion_id);
  if (yaOp) {
    const op: any = await db.get(`SELECT numero FROM ordenes_pago WHERE id = ?`, [yaOp.op_rendicion_id]);
    return NextResponse.json({ op_id: yaOp.op_rendicion_id, numero: op?.numero });
  }

  const empleado = items[0].empleado;
  const fecha = items[0].fecha_rendicion || new Date().toISOString().split("T")[0];
  const total = items.reduce((s: number, i: any) => s + (Number(i.importe) || 0), 0);
  const year = new Date(fecha).getFullYear() || new Date().getFullYear();
  const esEfectivo = (medio_pago || items[0].medio_pago) === "efectivo";

  // Calcular próximo número: OPE YYYY-NNNN o OP YYYY-NNNN
  const prefix = esEfectivo ? `OPE ${year}-` : `OP ${year}-`;
  const existing: any[] = await db.all(
    `SELECT numero FROM ordenes_pago WHERE numero LIKE ?`,
    [`${prefix}%`]
  );
  const nums = existing
    .map((r: any) => parseInt(String(r.numero).replace(prefix, ""), 10))
    .filter((n: number) => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const numero = `${prefix}${String(next).padStart(4, "0")}`;

  const result: any = await db.run(
    `INSERT INTO ordenes_pago
       (numero, fecha, nombre_en_banco, importe_bruto, total_retenciones, importe_neto,
        estado, concepto, origen)
     VALUES (?, ?, ?, ?, 0, ?, 'pagado', ?, 'rendicion')`,
    [
      numero,
      fecha,
      empleado,
      total,
      total,
      `Rendición de gastos — ${empleado}`,
    ]
  );
  const opId = Number(result.lastInsertRowid);

  // Vincular todos los items de esta rendición
  await db.run(
    `UPDATE viaticos SET op_rendicion_id = ? WHERE archivo_adjunto = ?`,
    [opId, clave]
  );

  return NextResponse.json({ op_id: opId, numero }, { status: 201 });
}
