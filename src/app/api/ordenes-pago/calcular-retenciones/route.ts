/**
 * GET /api/ordenes-pago/calcular-retenciones
 * Calcula las retenciones a aplicar en una orden de pago.
 * Base = suma de neto_gravado de las facturas (o importe_neto si neto_gravado=0).
 * Aplica MNI y acumulación mensual por proveedor+régimen.
 *
 * Query params:
 *   proveedor_id: number
 *   factura_ids:  "1,2,3"
 *   fecha:        "YYYY-MM-DD"
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const proveedorId   = Number(searchParams.get("proveedor_id") || "0");
  const facturaIdsRaw = searchParams.get("factura_ids") || "";
  const fecha         = searchParams.get("fecha") || new Date().toISOString().split("T")[0];

  if (!proveedorId) {
    return NextResponse.json({ error: "proveedor_id requerido" }, { status: 400 });
  }

  // Base de cálculo: suma de neto_gravado (o importe_neto) de las facturas seleccionadas
  let baseTotal = 0;
  if (facturaIdsRaw) {
    const ids = facturaIdsRaw.split(",").map(Number).filter(Boolean);
    if (ids.length > 0) {
      const facturas = await db.all(
        `SELECT importe_neto, neto_gravado FROM facturas_recibidas WHERE id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      for (const f of facturas) {
        const ng = Number(f.neto_gravado) || 0;
        const ne = Number(f.importe_neto) || 0;
        baseTotal += ng > 0 ? ng : ne;
      }
    }
  }

  // Obtener todos los regímenes activos
  const configs = await db.all(
    `SELECT * FROM retenciones_config WHERE activo=1 ORDER BY tipo, id`
  );

  // Mes/año de la fecha de la OP
  const [anioStr, mesStr] = fecha.split("-");
  const periodoFiltro = `${anioStr}-${mesStr}`;

  const resultado: any[] = [];

  for (const rc of configs) {
    const mni     = Number(rc.minimo_no_imponible) || 0;
    const alicuota = Number(rc.alicuota) || 0;
    let importe = 0;

    if (rc.acumula_mensual) {
      // Sumar retenciones ya aplicadas este mes para este proveedor+régimen
      const row = await db.get(
        `SELECT COALESCE(SUM(ra.base_calculo), 0) as acumulado
         FROM retenciones_aplicadas ra
         JOIN ordenes_pago op ON op.id = ra.orden_pago_id
         WHERE ra.config_id = ?
           AND op.proveedor_id = ?
           AND op.estado IN ('emitida','pagada')
           AND strftime('%Y-%m', op.fecha) = ?`,
        [rc.id, proveedorId, periodoFiltro]
      );
      const acumuladoMes = Number(row?.acumulado) || 0;
      const baseAcumulada = acumuladoMes + baseTotal;

      if (mni > 0) {
        if (baseAcumulada <= mni) {
          importe = 0; // No supera el MNI
        } else if (acumuladoMes >= mni) {
          importe = +(baseTotal * alicuota).toFixed(2); // Ya superó; alícuota completa
        } else {
          importe = +((baseAcumulada - mni) * alicuota).toFixed(2); // Solo el exceso
        }
      } else {
        importe = +(baseTotal * alicuota).toFixed(2);
      }
    } else {
      // Sin acumulación mensual: base directa con MNI de piso por operación
      const baseEfectiva = mni > 0 ? Math.max(0, baseTotal - mni) : baseTotal;
      importe = +(baseEfectiva * alicuota).toFixed(2);
    }

    resultado.push({
      config_id:       rc.id,
      tipo:            rc.tipo,
      descripcion:     rc.descripcion,
      codigo_regimen:  rc.codigo_regimen || "",
      base_calculo:    +baseTotal.toFixed(2),
      alicuota,
      importe,
      mni,
      acumula_mensual: Boolean(rc.acumula_mensual),
    });
  }

  return NextResponse.json({ base: +baseTotal.toFixed(2), retenciones: resultado });
}
