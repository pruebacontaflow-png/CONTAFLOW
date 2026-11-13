"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

const TIPOS_CBTE: Record<string, string> = {
  "1":  "FC-A",
  "6":  "FC-B",
  "11": "FC-C",
  "51": "FC-M",
  "2":  "ND-A",
  "7":  "ND-B",
  "3":  "NC-A",
  "8":  "NC-B",
};

const emptyForm = { fecha_solicitud: "", punto_venta: "", tipo_comprobante: "1", numero_desde: "", numero_hasta: "", cae: "", vencimiento_cae: "", notas: "" };

export default function ArcaEmisionPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pvFilter, setPvFilter] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ punto_venta: pvFilter, estado: estadoFilter });
    setLotes(await (await fetch(`/api/arca-cae?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [pvFilter, estadoFilter]);

  const getEstado = (l: any): { label: string; cls: string } => {
    if (l.estado === "anulado") return { label: "Anulado", cls: "badge-red" };
    if (!l.vencimiento_cae) return { label: "Vigente", cls: "badge-green" };
    const diff = new Date(l.vencimiento_cae).getTime() - new Date(today).getTime();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return { label: "Vencido", cls: "badge-red" };
    if (days <= 10) return { label: `Vence en ${days}d`, cls: "badge-yellow" };
    return { label: "Vigente", cls: "badge-green" };
  };

  const openEdit = (l: any) => {
    setForm({ fecha_solicitud: l.fecha_solicitud, punto_venta: String(l.punto_venta), tipo_comprobante: String(l.tipo_comprobante || "1"), numero_desde: String(l.numero_desde || ""), numero_hasta: String(l.numero_hasta || ""), cae: l.cae, vencimiento_cae: l.vencimiento_cae, notas: l.notas || "" });
    setEditId(l.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/arca-cae", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleUpdateEstado = async (id: number, estado: string) => {
    await fetch(`/api/arca-cae/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    fetch_();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este lote CAE?")) return;
    await fetch(`/api/arca-cae/${id}`, { method: "DELETE" });
    fetch_();
  };

  const totalVigentes = lotes.filter(l => getEstado(l).label === "Vigente").length;
  const totalVencidos = lotes.filter(l => getEstado(l).cls === "badge-red" && l.estado !== "anulado").length;

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={{ fontSize: "16px", fontWeight: "600" }}>ARCA — Lotes CAE</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <span style={{ fontSize: "12px", background: "#f0fdf4", color: "#0F6E56", padding: "3px 10px", borderRadius: "20px", fontWeight: "600" }}>{totalVigentes} vigentes</span>
            {totalVencidos > 0 && <span style={{ fontSize: "12px", background: "#fef2f2", color: "#993C1D", padding: "3px 10px", borderRadius: "20px", fontWeight: "600" }}>{totalVencidos} vencidos</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input placeholder="PV" value={pvFilter} onChange={e => setPvFilter(e.target.value)} style={{ width: "80px", padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }} />
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
            <option value="">Todos</option>
            <option value="vigente">Vigentes</option>
            <option value="anulado">Anulados</option>
          </select>
          {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm, fecha_solicitud: today }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nuevo lote</button>}
        </div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        {loading ? <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Cargando...</div> : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha solicitud</th>
                <th>PV</th>
                <th>Tipo cbte</th>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Cantidad</th>
                <th>CAE</th>
                <th>Vto. CAE</th>
                <th>Estado</th>
                {isAdmin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {lotes.length === 0 ? (
                <tr><td colSpan={isAdmin ? 10 : 9} style={{ textAlign: "center", color: "#9ca3af" }}>Sin lotes registrados</td></tr>
              ) : lotes.map(l => {
                const est = getEstado(l);
                return (
                  <tr key={l.id}>
                    <td>{formatDate(l.fecha_solicitud)}</td>
                    <td style={{ fontWeight: "600" }}>PV {String(l.punto_venta).padStart(4, "0")}</td>
                    <td>{TIPOS_CBTE[String(l.tipo_comprobante)] || `Cbte ${l.tipo_comprobante}`}</td>
                    <td>{String(l.numero_desde).padStart(8, "0")}</td>
                    <td>{String(l.numero_hasta).padStart(8, "0")}</td>
                    <td style={{ textAlign: "center" }}>{l.cantidad}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px", letterSpacing: "0.03em" }}>{l.cae}</td>
                    <td>{formatDate(l.vencimiento_cae)}</td>
                    <td><span className={`badge ${est.cls}`}>{est.label}</span></td>
                    {isAdmin && <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {l.estado !== "anulado" && <button onClick={() => handleUpdateEstado(l.id, "anulado")} title="Anular" style={{ ...iconBtn, color: "#993C1D", fontSize: "11px", width: "auto", padding: "0 8px" }}>Anular</button>}
                        <button onClick={() => handleDelete(l.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                      </div>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "560px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>Registrar lote CAE</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Fecha solicitud *</label><input type="date" value={form.fecha_solicitud} onChange={e => setForm(f => ({ ...f, fecha_solicitud: e.target.value }))} /></div>
              <div><label style={lbl}>Punto de venta *</label><input type="number" value={form.punto_venta} onChange={e => setForm(f => ({ ...f, punto_venta: e.target.value }))} placeholder="1" /></div>
              <div><label style={lbl}>Tipo de comprobante</label>
                <select value={form.tipo_comprobante} onChange={e => setForm(f => ({ ...f, tipo_comprobante: e.target.value }))}>
                  {Object.entries(TIPOS_CBTE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div />
              <div><label style={lbl}>Número desde</label><input type="number" value={form.numero_desde} onChange={e => setForm(f => ({ ...f, numero_desde: e.target.value }))} placeholder="00000001" /></div>
              <div><label style={lbl}>Número hasta</label><input type="number" value={form.numero_hasta} onChange={e => setForm(f => ({ ...f, numero_hasta: e.target.value }))} placeholder="00000100" /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>CAE *</label><input value={form.cae} onChange={e => setForm(f => ({ ...f, cae: e.target.value }))} placeholder="12345678901234" style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} /></div>
              <div><label style={lbl}>Vencimiento CAE *</label><input type="date" value={form.vencimiento_cae} onChange={e => setForm(f => ({ ...f, vencimiento_cae: e.target.value }))} /></div>
              <div><label style={lbl}>Notas</label><input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
            </div>
            {form.numero_desde && form.numero_hasta && (
              <div style={{ marginTop: "12px", padding: "10px 14px", background: "#f0f9ff", borderRadius: "8px", fontSize: "13px", color: "#185fa5" }}>
                Cantidad de comprobantes: <strong>{Math.max(0, (parseInt(form.numero_hasta) || 0) - (parseInt(form.numero_desde) || 0) + 1)}</strong>
              </div>
            )}
            {error && <div style={{ color: "#993C1D", fontSize: "13px", marginTop: "12px", background: "#f9ece7", padding: "10px", borderRadius: "8px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtn}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtn: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: "7px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtn: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
