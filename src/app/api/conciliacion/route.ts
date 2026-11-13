import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RegistroARCA {
  linea: number;
  fecha: string;        // YYYY-MM-DD
  tipo: string;
  numero: string;       // normalizado (sin ceros a la izquierda)
  numeroRaw: string;    // tal como viene en el TXT
  cuit: string;         // solo dígitos
  importe: number;
}

interface ParseError {
  linea: number;
  campo: string;
  mensaje: string;
  contenido: string;
}

// ─── Normalizadores ──────────────────────────────────────────────────────────

/** Número ARCA (sin guiones): "00000001289" → "1289" */
function normalizarNumeroARCA(n: string): string {
  return n.replace(/[-\s]/g, "").replace(/^0+/, "") || "0";
}

/**
 * Número del sistema: puede venir como "0001-00001289" o "00001289"
 * Tomamos el ÚLTIMO segmento después del guión (número de comprobante sin PV)
 * "0001-00001289" → "1289"
 * "00001289" → "1289"
 */
function normalizarNumeroSistema(n: string): string {
  const parts = String(n).split("-");
  const lastPart = parts[parts.length - 1].trim();
  return lastPart.replace(/^0+/, "") || "0";
}

function normalizarCuit(c: string): string {
  return c.replace(/[-\s]/g, "");
}

// ─── Parser TXT ARCA (ancho fijo) ─────────────────────────────────────────────
//   Pos 1-8   (idx 0-7)  : Fecha AAAAMMDD
//   Pos 9-10  (idx 8-9)  : Tipo de comprobante
//   Pos 11-21 (idx 10-20): Número de comprobante (11 chars)
//   Pos 30-41 (idx 29-40): CUIT emisor/receptor (12 chars)
//   Pos 42-56 (idx 41-55): Importe total (15 chars, 2 decimales implícitos)

function parseARCA(
  contenido: string
): { registros: RegistroARCA[]; errores: ParseError[] } {
  const lineas = contenido
    .split(/\r?\n/)
    .map((l, i) => ({ texto: l, num: i + 1 }))
    .filter(({ texto }) => texto.trim().length > 0);

  const registros: RegistroARCA[] = [];
  const errores: ParseError[] = [];

  for (const { texto, num } of lineas) {
    // Líneas de encabezado/pie comunes en archivos ARCA (empiezan con "0" o "9")
    const primerChar = texto.charAt(0);
    if (primerChar === "0" && num === 1) continue; // cabecera
    if (primerChar === "9") continue;              // pie de registro

    if (texto.length < 56) {
      errores.push({
        linea: num,
        campo: "longitud",
        mensaje: `La línea tiene ${texto.length} caracteres, se esperan al menos 56.`,
        contenido: texto.substring(0, 60),
      });
      continue;
    }

    // --- Fecha (pos 1-8, idx 0-7) ---
    const fechaRaw = texto.substring(0, 8).trim();
    if (!/^\d{8}$/.test(fechaRaw)) {
      errores.push({
        linea: num,
        campo: "fecha",
        mensaje: `Formato de fecha inválido: "${fechaRaw}" (se esperaba AAAAMMDD).`,
        contenido: texto.substring(0, 30),
      });
      continue;
    }
    const fechaISO = `${fechaRaw.substring(0, 4)}-${fechaRaw.substring(4, 6)}-${fechaRaw.substring(6, 8)}`;

    // --- Tipo comprobante (pos 9-10, idx 8-9) ---
    const tipoRaw = texto.substring(8, 10).trim();
    if (!tipoRaw) {
      errores.push({
        linea: num,
        campo: "tipo",
        mensaje: `Tipo de comprobante vacío en posiciones 9-10.`,
        contenido: texto.substring(0, 30),
      });
      continue;
    }

    // --- Número de comprobante (pos 11-21, idx 10-20) ---
    const numeroRaw = texto.substring(10, 21).trim();
    const numero = normalizarNumeroARCA(numeroRaw);

    // --- CUIT (pos 30-41, idx 29-40) ---
    const cuitRaw = texto.substring(29, 41).trim();
    const cuit = normalizarCuit(cuitRaw);
    if (cuit.length < 10) {
      errores.push({
        linea: num,
        campo: "cuit",
        mensaje: `CUIT inválido en posiciones 30-41: "${cuitRaw}" (${cuit.length} dígitos encontrados).`,
        contenido: texto.substring(0, 50),
      });
      continue;
    }

    // --- Importe (pos 42-56, idx 41-55) — 2 decimales implícitos ---
    const importeRaw = texto.substring(41, 56).trim();
    const importeInt = parseInt(importeRaw.replace(/\D/g, ""), 10);
    if (isNaN(importeInt) || importeRaw === "") {
      errores.push({
        linea: num,
        campo: "importe",
        mensaje: `Importe inválido en posiciones 42-56: "${importeRaw}".`,
        contenido: texto.substring(40, 56),
      });
      continue;
    }
    const importe = importeInt / 100;

    registros.push({
      linea: num,
      fecha: fechaISO,
      tipo: tipoRaw,
      numero,
      numeroRaw,
      cuit,
      importe,
    });
  }

  return { registros, errores };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { contenido, modo } = await req.json();

    if (!contenido || typeof contenido !== "string") {
      return NextResponse.json({ error: "Contenido vacío o inválido" }, { status: 400 });
    }
    if (modo !== "compras" && modo !== "ventas") {
      return NextResponse.json({ error: "Modo inválido. Usar 'compras' o 'ventas'" }, { status: 400 });
    }

    const { registros, errores: parseErrors } = parseARCA(contenido);

    if (registros.length === 0 && parseErrors.length === 0) {
      return NextResponse.json({
        error: "El archivo no contiene registros. Verificá que sea un TXT de ARCA en formato de ancho fijo.",
      }, { status: 400 });
    }

    // ── Cruce contra la base de datos ────────────────────────────────────────

    let facturasDB: Record<string, any>[] = [];

    if (modo === "compras") {
      facturasDB = await db.all(`
        SELECT fr.id, fr.tipo_comprobante, fr.numero, fr.fecha_emision,
               fr.importe_total, fr.importe_neto, fr.estado,
               p.cuit as cuit_contraparte, p.razon_social
        FROM facturas_recibidas fr
        JOIN proveedores p ON p.id = fr.proveedor_id
      `);
    } else {
      facturasDB = await db.all(`
        SELECT fe.id, fe.tipo_comprobante, fe.numero, fe.fecha_emision,
               fe.importe_total, fe.importe_neto, fe.estado,
               c.cuit as cuit_contraparte, c.razon_social
        FROM facturas_emitidas fe
        JOIN clientes c ON c.id = fe.cliente_id
      `);
    }

    // Indexar facturas del sistema por clave de búsqueda
    const indexDB = new Map<string, Record<string, any>>();
    for (const f of facturasDB) {
      const cuitNorm = normalizarCuit(String(f.cuit_contraparte || ""));
      const numNorm = normalizarNumeroSistema(String(f.numero || ""));
      const clave = modo === "compras"
        ? `${cuitNorm}::${numNorm}`
        : `${numNorm}`;
      indexDB.set(clave, f);
    }

    const conciliadas: any[] = [];
    const soloARCA: any[] = [];
    const idsEncontrados = new Set<number>();

    for (const reg of registros) {
      const clave = modo === "compras"
        ? `${reg.cuit}::${reg.numero}`
        : `${reg.numero}`;
      const match = indexDB.get(clave);

      if (match) {
        conciliadas.push({ arca: reg, sistema: match });
        idsEncontrados.add(match.id);
      } else {
        soloARCA.push(reg);
      }
    }

    // Facturas del sistema que NO aparecen en ARCA
    const soloSistema = facturasDB.filter(f => !idsEncontrados.has(f.id));

    // ── Resumen ──────────────────────────────────────────────────────────────

    const sumar = (arr: any[], key: string) =>
      arr.reduce((acc, item) => acc + (Number(item[key]) || 0), 0);

    const resumen = {
      conciliadas: {
        count: conciliadas.length,
        total: conciliadas.reduce((a, c) => a + c.arca.importe, 0),
      },
      soloARCA: {
        count: soloARCA.length,
        total: soloARCA.reduce((a, r) => a + r.importe, 0),
      },
      soloSistema: {
        count: soloSistema.length,
        total: sumar(soloSistema, "importe_total"),
      },
    };

    // ── Obtener razón social para los registros solo en ARCA ─────────────────

    const enriquecidos: any[] = [];
    for (const reg of soloARCA) {
      let razon_social: string | null = null;
      if (modo === "compras") {
        const prov = await db.get(
          `SELECT razon_social FROM proveedores WHERE replace(replace(cuit,'-',''),' ','') = ?`,
          [reg.cuit]
        );
        razon_social = prov?.razon_social || null;
      }
      enriquecidos.push({ ...reg, razon_social });
    }

    return NextResponse.json({
      parseErrors,
      conciliadas,
      soloARCA: enriquecidos,
      soloSistema,
      resumen,
      modo,
    });
  } catch (error) {
    console.error("Error conciliación ARCA:", error);
    return NextResponse.json({ error: "Error interno al procesar el archivo" }, { status: 500 });
  }
}
