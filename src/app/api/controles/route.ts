import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

export interface ControlCuadre {
  id: string;
  titulo: string;
  estado: "verde" | "rojo" | "gris";
  detalle: string;
  mes?: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const controles: ControlCuadre[] = [];
  const hoy = new Date().toISOString().slice(0, 10);
  const mesActual = hoy.slice(0, 7);

  // ── 1. Saldo banco = último extracto ─────────────────────────────────────
  try {
    const banco: any = await db.get(`SELECT id, banco, saldo_actual FROM cuentas_bancarias LIMIT 1`);
    if (banco) {
      const extBanco: any = await db.get(
        `SELECT saldo_final FROM extractos_bancarios WHERE cuenta_bancaria_id=? ORDER BY fecha_hasta DESC LIMIT 1`,
        [banco.id]
      );
      if (extBanco) {
        const diff = Math.abs(Number(banco.saldo_actual) - Number(extBanco.saldo_final));
        controles.push({
          id: "banco_vs_extracto",
          titulo: "Saldo banco = último extracto",
          estado: diff < 1 ? "verde" : "rojo",
          detalle: diff < 1
            ? `Saldo ${banco.banco}: $ ${Number(banco.saldo_actual).toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
            : `Diferencia de $ ${diff.toLocaleString("es-AR", { minimumFractionDigits: 2 })} en ${banco.banco} — saldo sistema vs extracto`,
        });
      } else {
        controles.push({ id: "banco_vs_extracto", titulo: "Saldo banco = último extracto", estado: "gris", detalle: "Sin extractos bancarios cargados" });
      }
    }
  } catch {}

  // ── 2. OPs pagadas sin conciliar con extracto ────────────────────────────
  try {
    const sinConciliar: any = await db.get(
      `SELECT COUNT(*) as n, COALESCE(SUM(importe_neto),0) as total
       FROM ordenes_pago WHERE estado='pagada' AND (linea_extracto_id IS NULL OR linea_extracto_id=0)`
    );
    const n = Number(sinConciliar?.n || 0);
    controles.push({
      id: "ops_conciliadas",
      titulo: "OPs pagadas conciliadas con extracto",
      estado: n === 0 ? "verde" : "rojo",
      detalle: n === 0
        ? "Todas las OPs pagadas están vinculadas al extracto"
        : `${n} OP${n !== 1 ? "s" : ""} pagada${n !== 1 ? "s" : ""} sin línea de extracto ($ ${Number(sinConciliar.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })})`,
    });
  } catch {}

  // ── 3. Facturas pagadas con OP ───────────────────────────────────────────
  try {
    const frSinOp: any = await db.get(
      `SELECT COUNT(*) as n FROM facturas_recibidas fr
       WHERE fr.estado='pagada'
         AND tipo_comprobante NOT LIKE 'Nota de Cr%'
         AND NOT EXISTS (SELECT 1 FROM ordenes_pago_items opi JOIN ordenes_pago op ON op.id=opi.orden_pago_id WHERE opi.factura_id=fr.id AND op.estado='pagada')`
    );
    const n = Number(frSinOp?.n || 0);
    controles.push({
      id: "fr_pagadas_con_op",
      titulo: "Facturas pagadas tienen OP asociada",
      estado: n === 0 ? "verde" : "rojo",
      detalle: n === 0
        ? "Todas las facturas marcadas pagadas tienen una OP pagada asociada"
        : `${n} factura${n !== 1 ? "s" : ""} con estado 'pagada' pero sin OP pagada vinculada`,
    });
  } catch {}

  // ── 4. Conciliación ARCA — diferencias pendientes ───────────────────────
  try {
    const arcaDiff: any = await db.get(
      `SELECT COUNT(*) as n FROM diferencias_arca WHERE estado='pendiente'`
    );
    const n = Number(arcaDiff?.n || 0);
    controles.push({
      id: "arca_diferencias",
      titulo: "Sin diferencias pendientes con ARCA",
      estado: n === 0 ? "verde" : "rojo",
      detalle: n === 0
        ? "No hay diferencias pendientes en la conciliación ARCA"
        : `${n} diferencia${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""} en conciliación ARCA`,
    });
  } catch {}

  // ── 5. Retenciones del mes con DDJJ SICORE ──────────────────────────────
  try {
    const retMes: any = await db.get(
      `SELECT COUNT(*) as n, COALESCE(SUM(importe),0) as total
       FROM retenciones_aplicadas ra
       JOIN ordenes_pago op ON op.id=ra.orden_pago_id
       WHERE strftime('%Y-%m', op.fecha)=?`,
      [mesActual]
    );
    const nRet = Number(retMes?.n || 0);
    if (nRet > 0) {
      const djSicore: any = await db.get(
        `SELECT COUNT(*) as n FROM declaraciones_juradas WHERE tipo LIKE '%SICORE%' AND periodo LIKE ? AND estado IN ('presentada','pagada')`,
        [mesActual + "%"]
      );
      const tieneDJ = Number(djSicore?.n || 0) > 0;
      controles.push({
        id: "retenciones_vs_sicore",
        titulo: "Retenciones del mes tienen DDJJ SICORE",
        estado: tieneDJ ? "verde" : "rojo",
        detalle: tieneDJ
          ? `DDJJ SICORE presentada para ${mesActual} (${nRet} retenciones)`
          : `${nRet} retenciones en ${mesActual} sin DDJJ SICORE presentada`,
        mes: mesActual,
      });
    } else {
      controles.push({
        id: "retenciones_vs_sicore",
        titulo: "Retenciones del mes tienen DDJJ SICORE",
        estado: "verde",
        detalle: `Sin retenciones registradas en ${mesActual}`,
        mes: mesActual,
      });
    }
  } catch {}

  // ── 6. Saldo caja chica = movimientos ────────────────────────────────────
  try {
    const cajas: any[] = await db.all(`SELECT id, nombre, saldo_actual FROM fondo_fijo_cajas WHERE activa=1`);
    for (const caja of cajas) {
      const movs: any = await db.get(
        `SELECT COALESCE(SUM(CASE WHEN tipo IN ('ingreso','reposicion') THEN importe ELSE -importe END),0) as saldo_calculado
         FROM fondo_fijo_movimientos WHERE caja_id=?`,
        [caja.id]
      );
      const diff = Math.abs(Number(caja.saldo_actual) - Number(movs?.saldo_calculado || 0));
      controles.push({
        id: `caja_chica_${caja.id}`,
        titulo: `Saldo caja "${caja.nombre}" = movimientos`,
        estado: diff < 1 ? "verde" : "rojo",
        detalle: diff < 1
          ? `Saldo $ ${Number(caja.saldo_actual).toLocaleString("es-AR", { minimumFractionDigits: 2 })} coincide con movimientos`
          : `Diferencia de $ ${diff.toLocaleString("es-AR", { minimumFractionDigits: 2 })} en caja "${caja.nombre}"`,
      });
    }
  } catch {}

  // ── 7. Asientos: debe = haber ────────────────────────────────────────────
  try {
    const asientos: any = await db.get(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN ABS(debe - haber) > 0.01 THEN 1 ELSE 0 END) as desequilibrados
       FROM (SELECT asiento_id, SUM(debe) as debe, SUM(haber) as haber FROM asientos_lineas GROUP BY asiento_id)`
    );
    const total = Number(asientos?.total || 0);
    const desq = Number(asientos?.desequilibrados || 0);
    if (total === 0) {
      controles.push({ id: "asientos_balance", titulo: "Asientos contables balanceados (debe = haber)", estado: "gris", detalle: "Sin asientos contables registrados" });
    } else {
      controles.push({
        id: "asientos_balance",
        titulo: "Asientos contables balanceados (debe = haber)",
        estado: desq === 0 ? "verde" : "rojo",
        detalle: desq === 0
          ? `${total} asiento${total !== 1 ? "s" : ""} balanceado${total !== 1 ? "s" : ""}`
          : `${desq} de ${total} asientos con debe ≠ haber`,
      });
    }
  } catch {}

  // ── 8. Facturas pendientes de pago sin OP emitida ───────────────────────
  try {
    const frVencidas: any = await db.get(
      `SELECT COUNT(*) as n FROM facturas_recibidas
       WHERE estado='pendiente_pago'
         AND tipo_comprobante NOT LIKE 'Nota de Cr%'
         AND fecha_vencimiento < ?`,
      [hoy]
    );
    const n = Number(frVencidas?.n || 0);
    controles.push({
      id: "fr_vencidas",
      titulo: "Facturas vencidas sin pagar",
      estado: n === 0 ? "verde" : "rojo",
      detalle: n === 0
        ? "No hay facturas vencidas pendientes de pago"
        : `${n} factura${n !== 1 ? "s" : ""} vencida${n !== 1 ? "s" : ""} con estado pendiente_pago`,
    });
  } catch {}

  // ── 9. Estados inconsistentes en facturas emitidas ──────────────────────
  try {
    const feRaro: any = await db.get(
      `SELECT COUNT(*) as n FROM facturas_emitidas
       WHERE estado NOT IN ('pendiente_revision','requiere_revision','cobro_pendiente','cobrada','anulada','rechazada')
         AND estado IS NOT NULL AND estado != ''`
    );
    const n = Number(feRaro?.n || 0);
    controles.push({
      id: "fe_estados",
      titulo: "Estados de facturas emitidas son válidos",
      estado: n === 0 ? "verde" : "rojo",
      detalle: n === 0
        ? "Todos los estados de facturas emitidas son válidos"
        : `${n} factura${n !== 1 ? "s" : ""} emitida${n !== 1 ? "s" : ""} con estado desconocido`,
    });
  } catch {}

  return NextResponse.json({ controles, generado: new Date().toISOString() });
}
