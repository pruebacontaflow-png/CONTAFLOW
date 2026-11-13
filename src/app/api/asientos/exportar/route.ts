/**
 * GET /api/asientos/exportar
 * Exporta Libro Diario o Libro Mayor en Excel.
 *
 * Query params:
 *   tipo:  "diario" | "mayor"
 *   anio:  number
 *   mes:   number (opcional; omitir para todo el año)
 *   cuenta_id: number (solo para mayor)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin", "contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tipo     = searchParams.get("tipo")     || "diario";
  const anio     = Number(searchParams.get("anio")  || new Date().getFullYear());
  const mes      = searchParams.get("mes")      ? Number(searchParams.get("mes"))      : null;
  const cuentaId = searchParams.get("cuenta_id") ? Number(searchParams.get("cuenta_id")) : null;

  const wb = XLSX.utils.book_new();

  if (tipo === "diario") {
    // ── Libro Diario ────────────────────────────────────────────────
    let sql = `
      SELECT a.fecha, a.descripcion, a.tipo,
             pc.codigo as cuenta_codigo, pc.nombre as cuenta_nombre,
             al.debe, al.haber
      FROM asientos a
      JOIN asientos_lineas al ON al.asiento_id = a.id
      JOIN plan_cuentas pc    ON pc.id = al.cuenta_id
      WHERE a.anio = ?
    `;
    const args: any[] = [anio];
    if (mes !== null) { sql += ` AND a.mes = ?`; args.push(mes); }
    sql += ` ORDER BY a.fecha, a.id, al.id`;

    const lineas = await db.all(sql, args);
    const header = ["Fecha", "Descripción asiento", "Tipo", "Cuenta código", "Cuenta nombre", "Debe", "Haber"];
    const data = [
      header,
      ...lineas.map(l => [
        l.fecha, l.descripcion, l.tipo, l.cuenta_codigo, l.cuenta_nombre,
        Number(l.debe), Number(l.haber),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [12,40,22,14,30,14,14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Libro Diario");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const filename = `libro-diario-${anio}${mes ? "-" + String(mes).padStart(2,"0") : ""}.xlsx`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── Libro Mayor ────────────────────────────────────────────────────
  const cuentasFiltro = cuentaId
    ? await db.all(`SELECT id, codigo, nombre FROM plan_cuentas WHERE id=?`, [cuentaId])
    : await db.all(`SELECT id, codigo, nombre FROM plan_cuentas WHERE imputable=1 ORDER BY codigo`);

  for (const cuenta of cuentasFiltro) {
    let sql = `
      SELECT a.fecha, a.descripcion, al.descripcion as linea_desc,
             al.debe, al.haber
      FROM asientos a
      JOIN asientos_lineas al ON al.asiento_id = a.id
      WHERE al.cuenta_id = ? AND a.anio = ?
    `;
    const args: any[] = [cuenta.id, anio];
    if (mes !== null) { sql += ` AND a.mes = ?`; args.push(mes); }
    sql += ` ORDER BY a.fecha, a.id`;

    const movs = await db.all(sql, args);
    if (movs.length === 0) continue;

    let saldoAcum = 0;
    const rows: any[][] = [["Fecha", "Descripción", "Detalle", "Debe", "Haber", "Saldo"]];
    for (const m of movs) {
      saldoAcum += Number(m.debe) - Number(m.haber);
      rows.push([m.fecha, m.descripcion, m.linea_desc, Number(m.debe), Number(m.haber), +saldoAcum.toFixed(2)]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [12,36,24,14,14,14].map(w => ({ wch: w }));
    // Nombre de hoja: código + primeros chars del nombre
    const sheetName = `${cuenta.codigo} ${(cuenta.nombre as string).slice(0,20)}`.slice(0,31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Sin movimientos"]]), "Mayor");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `libro-mayor-${anio}${mes ? "-" + String(mes).padStart(2,"0") : ""}${cuentaId ? `-cuenta${cuentaId}` : ""}.xlsx`;
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
