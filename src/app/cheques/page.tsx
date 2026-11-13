"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const ESTADOS: Record<string, { label: string; cls: string }> = {
  en_cartera:  { label: "En cartera",  cls: "badge-blue" },
  depositado:  { label: "Depositado",  cls: "badge-yellow" },
  cobrado:     { label: "Cobrado",     cls: "badge-green" },
  rechazado:   { label: "Rechazado",   cls: "badge-red" },
  anulado:     { label: "Anulado",     cls: "badge-gray" },
};

const emptyForm = { banco: "", numero: "", fecha_emision: "", fecha_cobro: "", beneficiario: "", importe: "", estado: "en_cartera", moneda: "ARS", notas: "" };

export default function ChequesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [cheques, setCheques] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search, estado: estadoFilter });
    setCheques(await (await fetch(`/api/cheques?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [search, estadoFilter]);

  const openCreate = () => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); };
  const openEdit = (c: any) => {
    setForm({ banco: c.banco, numero: c.numero, fecha_emision: c.fecha_emision, fecha_cobro: c.fecha_cobro || "", beneficiario: c.beneficiario, importe: String(c.importe), estado: c.estado, moneda: c.moneda, notas: c.notas || "" });
    setEditId(c.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/cheques/${editId}` : "/api/cheques";
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, importe: parseFloat(form.importe) || 0 }) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este cheque?")) return;
    await fetch(`/api/cheques/${id}`, { method: "DELETE" });
    fetch_();
  };

  const totales = cheques.reduce((a, c) => a + c.importe, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Cheques</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {isAdmin && <button className="btn-primary" onClick={openCreate} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nuevo cheque</button>}
        </div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input placeholder="Buscar por banco, número, beneficiario..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
          </div>
          <div style={{ background: "white", borderRadius: "8px", padding: "8px 16px", border: "0.5px solid rgba(0,0,0,0.10)", fontSize: "13px", fontWeight: "600" }}>
            Total: {formatCurrency(totales)}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead>
                <tr><th>Banco</th><th>Número</th><th>Emisión</th><th>Cobro</th><th>Beneficiario</th><th>Estado</th><th style={{ textAlign: "right" }}>Importe</th>{isAdmin && <th></th>}</tr>
              </thead>
              <tbody>
                {cheques.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin cheques{search ? " para esa búsqueda" : ""}</td></tr>
                ) : cheques.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: "500" }}>{c.banco}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{c.numero}</td>
                    <td style={{ fontSize: "12px" }}>{formatDate(c.fecha_emision)}</td>
                    <td style={{ fontSize: "12px", color: c.fecha_cobro ? "#374151" : "#9ca3af" }}>{c.fecha_cobro ? formatDate(c.fecha_cobro) : "—"}</td>
                    <td>{c.beneficiario}</td>
                    <td><span className={`badge ${ESTADOS[c.estado]?.cls || "badge-gray"}`}>{ESTADOS[c.estado]?.label || c.estado}</span></td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{c.moneda !== "ARS" ? `${c.moneda} ` : ""}{formatCurrency(c.importe)}</td>
                    {isAdmin && <td>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(c)} style={iconBtn}><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(c.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "520px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar cheque" : "Nuevo cheque"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Banco *</label><input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ej: Credicoop" /></div>
              <div><label style={lbl}>Número *</label><input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="0001234567" /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Beneficiario *</label><input value={form.beneficiario} onChange={e => setForm(f => ({ ...f, beneficiario: e.target.value }))} placeholder="Nombre o razón social" /></div>
              <div><label style={lbl}>Fecha emisión *</label><input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} /></div>
              <div><label style={lbl}>Fecha de cobro</label><input type="date" value={form.fecha_cobro} onChange={e => setForm(f => ({ ...f, fecha_cobro: e.target.value }))} /></div>
              <div><label style={lbl}>Importe *</label><input type="number" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Moneda</label>
                <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
              <div><label style={lbl}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Notas</label><input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones..." /></div>
            </div>
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
