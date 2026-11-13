import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS: Anthropic.Tool[] = [
  {
    name: "buscar_saldo_proveedor",
    description: "Consulta el saldo de cuenta corriente de un proveedor. Devuelve las facturas pendientes de pago y el saldo total.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string", description: "Nombre parcial o completo del proveedor" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "buscar_facturas_pendientes",
    description: "Busca facturas emitidas (cuentas por cobrar) pendientes de pago, opcionalmente filtradas por cliente.",
    input_schema: {
      type: "object" as const,
      properties: {
        cliente: { type: "string", description: "Nombre parcial del cliente (opcional)" },
        dias_vencidos: { type: "number", description: "Mínimo de días vencidos para filtrar (opcional)" },
      },
      required: [],
    },
  },
  {
    name: "buscar_saldo_banco",
    description: "Consulta el saldo actual de las cuentas bancarias registradas.",
    input_schema: {
      type: "object" as const,
      properties: {
        banco: { type: "string", description: "Nombre parcial del banco (opcional, para filtrar)" },
      },
      required: [],
    },
  },
  {
    name: "buscar_aging_cxp",
    description: "Consulta el aging de cuentas por pagar: facturas de proveedores agrupadas por tramos de vencimiento (0-30, 30-60, +60 días).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "buscar_vencimientos_proximos",
    description: "Busca vencimientos fiscales o de servicios en los próximos N días.",
    input_schema: {
      type: "object" as const,
      properties: {
        dias: { type: "number", description: "Horizonte en días (por defecto 30)" },
      },
      required: [],
    },
  },
  {
    name: "buscar_cliente",
    description: "Busca un cliente y su estado de cuenta: facturas emitidas, cobradas y pendientes.",
    input_schema: {
      type: "object" as const,
      properties: {
        nombre: { type: "string", description: "Nombre parcial o completo del cliente" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "resumen_financiero",
    description: "Devuelve un resumen financiero general: saldo bancario total, CxP total, CxC total, facturas emitidas del mes.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
];

async function runTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "buscar_saldo_proveedor": {
        const rows = await db.all(
          `SELECT p.nombre, fr.numero_comprobante, fr.fecha, fr.importe_total, fr.estado_31_12_2025 as estado
           FROM facturas_recibidas fr
           JOIN proveedores p ON fr.proveedor_id = p.id
           WHERE p.nombre LIKE ? AND fr.estado_31_12_2025 IN ('pendiente_pago','vencida')
           ORDER BY fr.fecha DESC LIMIT 20`,
          [`%${input.nombre}%`]
        );
        if (!rows.length) return `No se encontraron facturas pendientes para proveedores que coincidan con "${input.nombre}".`;
        const total = rows.reduce((s: number, r: any) => s + (r.importe_total || 0), 0);
        const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
        const lista = rows.map((r: any) => `  - ${r.nombre}: ${r.numero_comprobante} del ${r.fecha} → ${fmt.format(r.importe_total)}`).join("\n");
        return `Saldo pendiente con proveedores "${input.nombre}":\nTotal: ${fmt.format(total)}\n${lista}`;
      }

      case "buscar_facturas_pendientes": {
        let sql = `SELECT c.nombre AS cliente, fe.numero_comprobante, fe.fecha, fe.importe_total,
                   CAST(julianday('now') - julianday(fe.fecha_vencimiento) AS INTEGER) AS dias_vencidos
                   FROM facturas_emitidas fe
                   JOIN clientes c ON fe.cliente_id = c.id
                   WHERE fe.estado IN ('pendiente_cobro','vencida','cobro_pendiente')`;
        const args: any[] = [];
        if (input.cliente) { sql += ` AND c.nombre LIKE ?`; args.push(`%${input.cliente}%`); }
        if (input.dias_vencidos) { sql += ` AND CAST(julianday('now') - julianday(fe.fecha_vencimiento) AS INTEGER) >= ?`; args.push(input.dias_vencidos); }
        sql += ` ORDER BY dias_vencidos DESC LIMIT 20`;
        const rows = await db.all(sql, args);
        if (!rows.length) return "No se encontraron facturas pendientes con esos criterios.";
        const total = rows.reduce((s: number, r: any) => s + (r.importe_total || 0), 0);
        const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
        const lista = rows.map((r: any) => `  - ${r.cliente}: ${r.numero_comprobante} (${r.dias_vencidos > 0 ? `${r.dias_vencidos}d vencida` : "vigente"}) → ${fmt.format(r.importe_total)}`).join("\n");
        return `Facturas emitidas pendientes:\nTotal CxC: ${fmt.format(total)}\n${lista}`;
      }

      case "buscar_saldo_banco": {
        let sql = `SELECT nombre, numero_cuenta, saldo_actual, moneda FROM bancos WHERE 1=1`;
        const args: any[] = [];
        if (input.banco) { sql += ` AND nombre LIKE ?`; args.push(`%${input.banco}%`); }
        sql += ` ORDER BY saldo_actual DESC`;
        const rows = await db.all(sql, args);
        if (!rows.length) return "No se encontraron cuentas bancarias.";
        const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
        const totalARS = rows.filter((r: any) => r.moneda === "ARS").reduce((s: number, r: any) => s + (r.saldo_actual || 0), 0);
        const lista = rows.map((r: any) => `  - ${r.nombre} ${r.numero_cuenta ? `(${r.numero_cuenta})` : ""}: ${fmt.format(r.saldo_actual || 0)} ${r.moneda}`).join("\n");
        return `Saldos bancarios:\nTotal ARS: ${fmt.format(totalARS)}\n${lista}`;
      }

      case "buscar_aging_cxp": {
        const rows = await db.all(`
          SELECT
            SUM(CASE WHEN julianday('now') - julianday(fr.fecha_vencimiento) BETWEEN 0 AND 30 THEN fr.importe_total ELSE 0 END) AS t0_30,
            SUM(CASE WHEN julianday('now') - julianday(fr.fecha_vencimiento) BETWEEN 31 AND 60 THEN fr.importe_total ELSE 0 END) AS t30_60,
            SUM(CASE WHEN julianday('now') - julianday(fr.fecha_vencimiento) > 60 THEN fr.importe_total ELSE 0 END) AS t60mas,
            SUM(fr.importe_total) AS total
          FROM facturas_recibidas fr
          WHERE fr.estado_31_12_2025 IN ('pendiente_pago','vencida')
        `);
        const r = rows[0] || {};
        const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
        return `Aging CxP (facturas a pagar):\n  0-30 días:  ${fmt.format(r.t0_30 || 0)}\n  30-60 días: ${fmt.format(r.t30_60 || 0)}\n  +60 días:   ${fmt.format(r.t60mas || 0)}\n  TOTAL:      ${fmt.format(r.total || 0)}`;
      }

      case "buscar_vencimientos_proximos": {
        const dias = input.dias || 30;
        const rows = await db.all(
          `SELECT tipo, descripcion, fecha_vencimiento, importe, estado
           FROM vencimientos
           WHERE fecha_vencimiento BETWEEN date('now') AND date('now', '+' || ? || ' days')
           ORDER BY fecha_vencimiento ASC LIMIT 15`,
          [dias]
        );
        if (!rows.length) return `No hay vencimientos en los próximos ${dias} días.`;
        const lista = rows.map((r: any) => `  - ${r.fecha_vencimiento} | ${r.tipo} | ${r.descripcion}${r.importe ? ` → $${r.importe}` : ""}`).join("\n");
        return `Vencimientos próximos (${dias} días):\n${lista}`;
      }

      case "buscar_cliente": {
        const clientes = await db.all(`SELECT * FROM clientes WHERE nombre LIKE ? LIMIT 3`, [`%${input.nombre}%`]);
        if (!clientes.length) return `No se encontró ningún cliente con "${input.nombre}".`;
        const c = clientes[0] as any;
        const facturas = await db.all(
          `SELECT tipo_comprobante, numero_comprobante, fecha, importe_total, estado FROM facturas_emitidas WHERE cliente_id=? ORDER BY fecha DESC LIMIT 10`,
          [c.id]
        );
        const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
        const totalEmitido = facturas.filter((f: any) => !["NC"].includes(f.tipo_comprobante)).reduce((s: number, f: any) => s + (f.importe_total || 0), 0);
        const pendiente = facturas.filter((f: any) => ["pendiente_cobro","cobro_pendiente","vencida"].includes(f.estado)).reduce((s: number, f: any) => s + (f.importe_total || 0), 0);
        return `Cliente: ${c.nombre}\nCUIT: ${c.cuit || "—"} | COND IVA: ${c.condicion_iva || "—"}\nTotal facturado: ${fmt.format(totalEmitido)}\nPendiente de cobro: ${fmt.format(pendiente)}\nÚltimas facturas: ${facturas.length}`;
      }

      case "resumen_financiero": {
        const [banco, cxp, cxc, facMes] = await Promise.all([
          db.all(`SELECT SUM(saldo_actual) AS total FROM bancos WHERE moneda='ARS'`),
          db.all(`SELECT SUM(importe_total) AS total FROM facturas_recibidas WHERE estado_31_12_2025 IN ('pendiente_pago','vencida')`),
          db.all(`SELECT SUM(importe_total) AS total FROM facturas_emitidas WHERE estado IN ('pendiente_cobro','cobro_pendiente','vencida')`),
          db.all(`SELECT SUM(importe_total) AS total, COUNT(*) AS cant FROM facturas_emitidas WHERE substr(fecha,1,7)=strftime('%Y-%m','now') AND tipo_comprobante NOT IN ('NC','ND')`),
        ]);
        const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
        return `Resumen financiero:\n  Saldo bancario ARS:    ${fmt.format((banco[0] as any)?.total || 0)}\n  CxP pendiente:         ${fmt.format((cxp[0] as any)?.total || 0)}\n  CxC pendiente:         ${fmt.format((cxc[0] as any)?.total || 0)}\n  Facturación mes actual: ${fmt.format((facMes[0] as any)?.total || 0)} (${(facMes[0] as any)?.cant || 0} facturas)`;
      }

      default:
        return "Herramienta no reconocida.";
    }
  } catch (e: any) {
    return `Error ejecutando herramienta: ${e.message}`;
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const { messages } = await req.json();
    if (!messages?.length) return NextResponse.json({ error: "messages requerido" }, { status: 400 });

    const apiMessages: Anthropic.MessageParam[] = messages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    let response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: `Sos el asistente contable de ContaFlow para IT Click Video S.A. (Argentina).
Respondés consultas financieras y contables en español argentino, usando las herramientas disponibles para consultar datos reales de la empresa.
Usá los datos que te devuelven las herramientas, nunca inventes números.
Sé conciso y claro. Formateá los montos en pesos argentinos (ARS).
Si no encontrás datos, decilo claramente.`,
      tools: TOOLS,
      messages: apiMessages,
    });

    const usedTools: string[] = [];

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        usedTools.push(block.name);
        const result = await runTool(block.name, block.input);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      apiMessages.push({ role: "assistant", content: response.content });
      apiMessages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        system: `Sos el asistente contable de ContaFlow para IT Click Video S.A. (Argentina).
Respondés consultas financieras y contables en español argentino, usando las herramientas disponibles para consultar datos reales de la empresa.
Usá los datos que te devuelven las herramientas, nunca inventes números.
Sé conciso y claro. Formateá los montos en pesos argentinos (ARS).
Si no encontrás datos, decilo claramente.`,
        tools: TOOLS,
        messages: apiMessages,
      });
    }

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return NextResponse.json({ message: textBlock?.text || "Sin respuesta.", used_tools: usedTools });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Error interno" }, { status: 500 });
  }
}
