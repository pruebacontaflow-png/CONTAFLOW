import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { tipo, filas } = await req.json();
    if (!tipo || !filas || !Array.isArray(filas)) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });

    const resultados = { importados: 0, observaciones: [] as any[], rechazados: [] as any[] };

    if (tipo === 'proveedores') {
      for (let i = 0; i < filas.length; i++) {
        const f = filas[i]; const fila = i + 2;
        if (!f.razon_social || !f.cuit) { resultados.rechazados.push({ fila, motivo: 'Razón social y CUIT son obligatorios', datos: f }); continue; }
        try {
          await db.run(`INSERT OR IGNORE INTO proveedores (razon_social, cuit, categoria, email, telefono, condicion_iva) VALUES (?, ?, ?, ?, ?, ?)`,
            [f.razon_social, f.cuit, f.categoria||'', f.email||'', f.telefono||'', f.condicion_iva||'Responsable Inscripto']);
          resultados.importados++;
        } catch (e: any) { resultados.observaciones.push({ fila, motivo: 'CUIT duplicado', datos: f }); }
      }
    }

    if (tipo === 'clientes') {
      for (let i = 0; i < filas.length; i++) {
        const f = filas[i]; const fila = i + 2;
        if (!f.razon_social || !f.cuit) { resultados.rechazados.push({ fila, motivo: 'Razón social y CUIT son obligatorios', datos: f }); continue; }
        try {
          await db.run(`INSERT OR IGNORE INTO clientes (razon_social, cuit, categoria, email, condicion_iva) VALUES (?, ?, ?, ?, ?)`,
            [f.razon_social, f.cuit, f.categoria||'', f.email||'', f.condicion_iva||'Responsable Inscripto']);
          resultados.importados++;
        } catch (e) { resultados.observaciones.push({ fila: i + 2, motivo: 'CUIT duplicado', datos: f }); }
      }
    }

    if (tipo === 'facturas_recibidas') {
      for (let i = 0; i < filas.length; i++) {
        const f = filas[i]; const fila = i + 2;
        if (!f.cuit_proveedor || !f.numero || !f.fecha_emision || !f.fecha_vencimiento) {
          resultados.rechazados.push({ fila, motivo: 'CUIT proveedor, número y fechas son obligatorios', datos: f }); continue;
        }
        const proveedor = await db.get(`SELECT id FROM proveedores WHERE cuit = ? AND activo = 1`, [f.cuit_proveedor]);
        if (!proveedor) { resultados.rechazados.push({ fila, motivo: `Proveedor con CUIT ${f.cuit_proveedor} no encontrado`, datos: f }); continue; }
        try {
          const neto = parseFloat(f.importe_neto) || 0;
          const tasas: Record<string, number> = { '21%': 0.21, '10.5%': 0.105, 'exento': 0, 'no_gravado': 0 };
          const tasa = tasas[f.tipo_iva || '21%'] || 0.21;
          const iva = neto * tasa;
          await db.run(
            `INSERT INTO facturas_recibidas (proveedor_id, tipo_comprobante, numero, fecha_emision, fecha_vencimiento, importe_neto, tipo_iva, importe_iva, importe_total, concepto, estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [proveedor.id, f.tipo_comprobante||'A', f.numero, f.fecha_emision, f.fecha_vencimiento, neto, f.tipo_iva||'21%', iva, neto+iva, f.concepto||'', f.estado||'pendiente_pago']
          );
          resultados.importados++;
        } catch (e: any) { resultados.observaciones.push({ fila, motivo: 'Error al insertar: ' + e.message, datos: f }); }
      }
    }

    return NextResponse.json(resultados);
  } catch (error) {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
