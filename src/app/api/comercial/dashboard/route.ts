import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

// Importe con signo: las notas de crédito restan
const IMP = `CASE WHEN tipo_comprobante LIKE 'Nota de Cr%' THEN -ABS(importe_total) ELSE importe_total END`;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const hoy = new Date();
    const anio = req.nextUrl.searchParams.get("anio") || String(hoy.getFullYear());
    // Mes de referencia: el mes actual si es el año en curso, si no diciembre
    const mesRef = anio === String(hoy.getFullYear()) ? String(hoy.getMonth() + 1).padStart(2, "0") : "12";
    const mesAnt = mesRef === "01" ? `${Number(anio) - 1}-12` : `${anio}-${String(Number(mesRef) - 1).padStart(2, "0")}`;

    const anios = await db.all(`SELECT DISTINCT substr(fecha_emision,1,4) AS anio FROM facturas_emitidas WHERE fecha_emision <> '' ORDER BY anio DESC`);

    const topClientes = await db.all(`
      SELECT COALESCE(c.razon_social, 'Sin cliente') AS nombre, SUM(${IMP.replace(/tipo_comprobante|importe_total/g, m => "fe." + m)}) AS total_facturado, COUNT(fe.id) AS cant_facturas
      FROM facturas_emitidas fe LEFT JOIN clientes c ON fe.cliente_id = c.id
      WHERE substr(fe.fecha_emision,1,4) = ?
      GROUP BY fe.cliente_id HAVING ABS(total_facturado) > 0.01
      ORDER BY total_facturado DESC LIMIT 10`, [anio]);

    const evolucionMensual = await db.all(`
      SELECT substr(fecha_emision,1,7) AS mes, SUM(${IMP}) AS total
      FROM facturas_emitidas WHERE substr(fecha_emision,1,4) = ?
      GROUP BY mes ORDER BY mes`, [anio]);

    const proyeccion = await db.all(`
      SELECT periodo AS mes, ingresos_proyectados AS proyectado, ingresos_reales AS real, gastos_comerciales AS gastos
      FROM presupuesto_comercial WHERE cliente_nombre = 'Área Comercial Total' AND substr(periodo,1,4) = ? ORDER BY periodo`, [anio]);

    const resumenAcuerdos = await db.get(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN estado='activo' THEN 1 ELSE 0 END) AS activos,
             SUM(CASE WHEN estado='activo' AND moneda LIKE 'ARS%' THEN importe_mensual ELSE 0 END) AS mrr
      FROM acuerdos_comerciales
      WHERE COALESCE(substr(fecha_inicio_iso,1,4), ?) <= ? AND (COALESCE(fecha_fin_iso,'') = '' OR substr(fecha_fin_iso,1,4) >= ?)`, [anio, anio, anio]);

    const comisionesResumen = await db.get(`
      SELECT SUM(CASE WHEN estado NOT IN ('pagada','sin comisión') THEN importe ELSE 0 END) AS pendiente,
             SUM(CASE WHEN estado = 'pagada' THEN importe ELSE 0 END) AS pagado_mes,
             COUNT(CASE WHEN estado NOT IN ('pagada','sin comisión') THEN 1 END) AS cant_pendientes
      FROM comisiones WHERE substr(periodo,1,4) = ?`, [anio]);

    const topAcuerdos = await db.all(`
      SELECT COALESCE(a.campania, a.descripcion) AS descripcion, a.importe_mensual, a.moneda, a.estado,
             COALESCE(c.razon_social, a.cliente_original) AS cliente_nombre, a.responsable
      FROM acuerdos_comerciales a LEFT JOIN clientes c ON a.cliente_id = c.id
      WHERE COALESCE(substr(a.fecha_inicio_iso,1,4), ?) <= ? AND (COALESCE(a.fecha_fin_iso,'') = '' OR substr(a.fecha_fin_iso,1,4) >= ?)
      ORDER BY a.importe_mensual DESC LIMIT 5`, [anio, anio, anio]);

    const comparativaMes = await db.get(`
      SELECT SUM(CASE WHEN substr(fecha_emision,1,7) = ? THEN ${IMP} ELSE 0 END) AS mes_actual,
             SUM(CASE WHEN substr(fecha_emision,1,7) = ? THEN ${IMP} ELSE 0 END) AS mes_anterior
      FROM facturas_emitidas`, [`${anio}-${mesRef}`, mesAnt]);

    const topVendedores = await db.all(`
      SELECT empleado AS nombre, SUM(importe) AS total_comisiones, COUNT(id) AS cant_comisiones
      FROM comisiones WHERE substr(periodo,1,4) = ? AND importe > 0
      GROUP BY empleado ORDER BY total_comisiones DESC LIMIT 10`, [anio]);

    const fact = await db.get(`SELECT COALESCE(SUM(${IMP}),0) AS total FROM facturas_emitidas WHERE substr(fecha_emision,1,4) = ? AND COALESCE(moneda,'ARS') NOT IN ('USD','DOL')`, [anio]);
    const cost = await db.get(`SELECT COALESCE(SUM(${IMP}),0) AS total FROM facturas_recibidas WHERE substr(fecha_emision,1,4) = ? AND COALESCE(moneda,'ARS') NOT IN ('USD','DOL')`, [anio]);
    const facturacion = Number(fact?.total) || 0;
    const costosTotales = Number(cost?.total) || 0;
    const beneficios = facturacion - costosTotales;
    const pct = facturacion > 0 ? Math.max(0, Math.min(100, (beneficios / facturacion) * 100)) : 0;

    return NextResponse.json({
      anio, mesRef: `${anio}-${mesRef}`, anios: anios.map((a: any) => a.anio),
      topClientes, evolucionMensual, proyeccion,
      resumenAcuerdos: resumenAcuerdos || {}, comisionesResumen: comisionesResumen || {},
      topAcuerdos, comparativaMes: comparativaMes || {}, topVendedores,
      gauge: { facturacion, costos: costosTotales, beneficios, pct },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
