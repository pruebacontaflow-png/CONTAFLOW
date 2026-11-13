"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPOS: Record<string, string[]> = {
  compras: ["En ARCA, no está en CxP", "En CxP, no está en ARCA", "Importe distinto", "Número mal cargado en CxP"],
  ventas: ["En ARCA, no está en CxC"],
};

export default function DiferenciasARCAPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [libro, setLibro] = useState<"compras" | "ventas">("compras");
  const [estado, setEstado] = useState("pendiente");
  const [tipo, setTipo] = useState(TIPOS.compras[0]);
  const [data, setData] = useState<{ rows: any[]; resumen: any[] }>({ rows: [], resumen: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/conciliacion/diferencias?libro=${libro}&estado=${estado}`);
    setData(await r.json());
    setLoading(false);
  };
  useEffect(() => { load(); }, [libro, estado]);
  useEffect(() => { setTipo(TIPOS[libro][0]); }, [libro]);

  const marcar = async (id: number, nuevo: string) => {
    const resolucion = nuevo === "conciliado" ? (prompt("¿Cómo se resolvió? (opcional)") ?? "") : "";
    await fetch("/api/conciliacion/diferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, estado: nuevo, resolucion }) });
    load();
  };

  const cuenta = (t: string, e = "pendiente") => data.resumen.filter(r => r.libro === libro && r.tipo_diferencia === t && r.estado === e).reduce((a, r) => a + r.n, 0);
  const filas = data.rows.filter(r => r.tipo_diferencia === tipo);
  const tab = (activo: boolean) => ({ padding: "8px 14px", fontSize: "13px", borderRadius: "8px", border: "0.5px solid #e5e7eb", background: activo ? "#185fa5" : "white", color: activo ? "white" : "#374151", cursor: "pointer" });

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: 600 }}>Diferencias a conciliar con ARCA — 2025</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={tab(libro === "compras")} onClick={() => setLibro("compras")}>Compras (CxP)</button>
          <button style={tab(libro === "ventas")} onClick={() => setLibro("ventas")}>Ventas (CxC)</button>
          <select value={estado} onChange={e => setEstado(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
            <option value="pendiente">Pendientes</option>
            <option value="conciliado">Conciliadas</option>
            <option value="todos">Todas</option>
          </select>
        </div>
      </div>
      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
          Solo se listan los comprobantes que no coinciden entre la planilla interna y ARCA. Todo lo que coincide en número e importe se considera conciliado y no aparece acá.
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          {TIPOS[libro].map(t => (
            <button key={t} style={tab(tipo === t)} onClick={() => setTipo(t)}>
              {t} <span style={{ opacity: 0.8 }}>({cuenta(t)} pend. · {cuenta(t, "conciliado")} concil.)</span>
            </button>
          ))}
        </div>
        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead><tr><th>Fecha</th><th>{libro === "compras" ? "Proveedor" : "Cliente"}</th><th>Comprobante</th><th>En planilla</th><th>En ARCA</th><th style={{ textAlign: "right" }}>Importe</th><th>Detalle</th><th>Estado</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {filas.length === 0 ? <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin diferencias {estado === "pendiente" ? "pendientes" : ""}</td></tr> : filas.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontSize: "12px" }}>{r.fecha ? formatDate(r.fecha) : "—"}</td>
                    <td style={{ fontWeight: 500 }}>{r.contraparte}{r.cuit ? <div style={{ fontSize: "11px", color: "#6b7280" }}>CUIT {r.cuit}</div> : null}</td>
                    <td style={{ fontSize: "12px", fontFamily: "monospace" }}>{r.comprobante}</td>
                    <td style={{ fontSize: "12px" }}>{r.valor_sistema}</td>
                    <td style={{ fontSize: "12px" }}>{r.valor_arca}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>
                      {r.diferencia != null ? <>{formatCurrency(r.importe_sistema)} vs {formatCurrency(r.importe_arca)}<div style={{ color: "#993C1D", fontSize: "11px" }}>dif. {formatCurrency(r.diferencia)}</div></> : formatCurrency(r.importe_arca ?? r.importe_sistema ?? 0)}
                    </td>
                    <td style={{ fontSize: "12px", color: "#6b7280", maxWidth: "320px" }}>{r.detalle}{r.resolucion ? <div style={{ color: "#3B6D11" }}>Resolución: {r.resolucion}</div> : null}</td>
                    <td>{r.estado === "conciliado" ? <span className="badge badge-green">Conciliado</span> : <span className="badge badge-yellow">Pendiente</span>}</td>
                    {isAdmin && <td>
                      {r.estado === "pendiente"
                        ? <button onClick={() => marcar(r.id, "conciliado")} title="Marcar conciliado" style={{ border: "none", background: "none", cursor: "pointer", color: "#3B6D11" }}><CheckCircle2 size={16} /></button>
                        : <button onClick={() => marcar(r.id, "pendiente")} title="Volver a pendiente" style={{ border: "none", background: "none", cursor: "pointer", color: "#6b7280" }}><RotateCcw size={15} /></button>}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
