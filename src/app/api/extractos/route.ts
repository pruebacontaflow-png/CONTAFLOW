import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import * as XLSX from "xlsx";
import crypto from "crypto";

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function normalizeDate(raw: string): string {
  if (!raw) return "";
  // DD/MM/YYYY → YYYY-MM-DD
  const match = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
  // YYYY-MM-DD already
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10);
  return raw;
}

function normalizeAmount(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;
  // Remove thousand separators (dots) and use period as decimal
  const str = String(val).replace(/\./g, "").replace(",", ".");
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

type CsvRow = Record<string, any>;

function detectCol(headers: string[], candidates: string[]): number {
  for (const h of headers) {
    const low = h.toLowerCase().trim();
    if (candidates.some(c => low.includes(c))) return headers.indexOf(h);
  }
  return -1;
}

function parseRows(rows: CsvRow[]): Array<{fecha:string;descripcion:string;referencia:string;debito:number;credito:number;saldo:number}> {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);

  const iDate = detectCol(headers, ["fecha","date","día","dia"]);
  const iDesc = detectCol(headers, ["descripci","descrip","concepto","detalle","movimiento","transac"]);
  const iRef  = detectCol(headers, ["ref","comprob","numero","nro","doc"]);
  const iDeb  = detectCol(headers, ["debito","debe","egreso","cargo","salida","out"]);
  const iCred = detectCol(headers, ["credito","haber","ingreso","abono","entrada","in"]);
  const iSald = detectCol(headers, ["saldo","balance"]);
  const iMov  = detectCol(headers, ["importe","monto","amount"]);

  return rows.map(row => {
    const vals = Object.values(row);
    let debito  = iDeb  >= 0 ? normalizeAmount(vals[iDeb])  : 0;
    let credito = iCred >= 0 ? normalizeAmount(vals[iCred]) : 0;
    // Single amount column with sign
    if (iDeb < 0 && iCred < 0 && iMov >= 0) {
      const v = normalizeAmount(vals[iMov]);
      if (v < 0) debito = Math.abs(v);
      else credito = v;
    }
    return {
      fecha:       normalizeDate(String(vals[iDate] ?? "")),
      descripcion: String(vals[iDesc] ?? ""),
      referencia:  iRef >= 0 ? String(vals[iRef] ?? "") : "",
      debito:      Math.abs(debito),
      credito:     Math.abs(credito),
      saldo:       iSald >= 0 ? normalizeAmount(vals[iSald]) : 0,
    };
  }).filter(r => r.fecha && (r.debito > 0 || r.credito > 0));
}

// ──────────────────────────────────────────────────────────────────
// GET — listar extractos
// ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const cuenta = searchParams.get("cuenta");

  let sql = `SELECT eb.*, cb.banco, cb.tipo as tipo_cuenta, cb.moneda,
             (SELECT COUNT(*) FROM extractos_lineas WHERE extracto_id=eb.id) as total_lineas,
             (SELECT COUNT(*) FROM extractos_lineas WHERE extracto_id=eb.id AND conciliado=1) as lineas_conciliadas
             FROM extractos_bancarios eb
             JOIN cuentas_bancarias cb ON cb.id=eb.cuenta_bancaria_id`;
  const args: any[] = [];
  if (cuenta) { sql += ` WHERE eb.cuenta_bancaria_id=?`; args.push(cuenta); }
  sql += ` ORDER BY eb.fecha_hasta DESC, eb.id DESC`;

  const rows = await db.all(sql, args);
  return NextResponse.json(rows);
}

// ──────────────────────────────────────────────────────────────────
// POST — importar extracto (CSV o XLSX)
// ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !["admin","contador"].includes((session.user as any).role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const formData    = await req.formData();
  const file        = formData.get("archivo") as File | null;
  const cuentaId    = formData.get("cuenta_bancaria_id");
  const saldoInicial= formData.get("saldo_inicial");
  const saldoFinal  = formData.get("saldo_final");
  const observaciones = formData.get("observaciones") as string || "";

  if (!file || !cuentaId) {
    return NextResponse.json({ error: "Archivo y cuenta requeridos" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Detección de duplicado por hash SHA-256 del contenido
  const hashArchivo = crypto.createHash("sha256").update(buf).digest("hex");
  const duplicado = await db.get(
    `SELECT id, nombre_archivo FROM extractos_bancarios WHERE hash_archivo=?`,
    [hashArchivo]
  );
  if (duplicado) {
    return NextResponse.json(
      { error: `Este archivo ya fue importado (extracto #${duplicado.id}: ${duplicado.nombre_archivo})` },
      { status: 409 }
    );
  }

  let rows: CsvRow[] = [];

  try {
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  } catch {
    return NextResponse.json({ error: "No se pudo parsear el archivo. Usá formato CSV o XLSX." }, { status: 400 });
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: "El archivo está vacío o no tiene filas de datos" }, { status: 400 });
  }

  const lineas = parseRows(rows);
  if (lineas.length === 0) {
    return NextResponse.json({ error: "No se encontraron movimientos válidos. Verificá que las columnas tengan los encabezados esperados (fecha, descripcion/concepto, debito/credito)." }, { status: 400 });
  }

  // Calcular fechas y totales
  const fechas = lineas.map(l => l.fecha).filter(Boolean).sort();
  const fechaDesde = fechas[0] ?? "";
  const fechaHasta = fechas[fechas.length - 1] ?? "";
  const totalDeb   = lineas.reduce((s, l) => s + l.debito,  0);
  const totalCred  = lineas.reduce((s, l) => s + l.credito, 0);

  // Guardar mapeo de columnas detectado en la cuenta bancaria (para futuros imports)
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    await db.run(
      `UPDATE cuentas_bancarias SET config_columnas=? WHERE id=?`,
      [JSON.stringify(headers), Number(cuentaId)]
    );
  }

  // Insertar extracto
  const r = await db.run(
    `INSERT INTO extractos_bancarios (cuenta_bancaria_id,fecha_desde,fecha_hasta,saldo_inicial,saldo_final,total_debitos,total_creditos,cantidad_lineas,nombre_archivo,observaciones,hash_archivo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [Number(cuentaId), fechaDesde, fechaHasta,
     normalizeAmount(saldoInicial), normalizeAmount(saldoFinal),
     totalDeb, totalCred, lineas.length, file.name, observaciones, hashArchivo]
  );
  const extractoId = Number(r.lastInsertRowid);

  // Obtener reglas activas
  const reglas = await db.all(`SELECT * FROM reglas_clasificacion WHERE activo=1 ORDER BY prioridad DESC`);

  // Insertar líneas con clasificación automática
  for (const l of lineas) {
    let categoria = "";
    let cuentaContableId: number | null = null;

    for (const regla of reglas) {
      const desc = l.descripcion.toLowerCase();
      const pat  = (regla.patron as string).toLowerCase();
      let match = false;
      if (regla.tipo_match === "contiene") match = desc.includes(pat);
      else if (regla.tipo_match === "empieza") match = desc.startsWith(pat);
      else if (regla.tipo_match === "termina") match = desc.endsWith(pat);
      else if (regla.tipo_match === "exacto")  match = desc === pat;
      if (match) {
        categoria = regla.categoria as string || "";
        cuentaContableId = regla.cuenta_contable_id ? Number(regla.cuenta_contable_id) : null;
        break;
      }
    }

    await db.run(
      `INSERT INTO extractos_lineas (extracto_id,fecha,descripcion,referencia,debito,credito,saldo,categoria,cuenta_contable_id)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [extractoId, l.fecha, l.descripcion, l.referencia, l.debito, l.credito, l.saldo, categoria, cuentaContableId]
    );
  }

  return NextResponse.json({ id: extractoId, lineas: lineas.length }, { status: 201 });
}
