"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search, ChevronDown, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/utils";

const TIPOS: Record<string, { label: string; cls: string }> = {
  reunion:    { label: "Reunión",        cls: "badge-blue" },
  directorio: { label: "Directorio",     cls: "badge-blue" },
  asamblea:   { label: "Asamblea",       cls: "badge-yellow" },
  comite:     { label: "Comité",         cls: "badge-gray" },
  otro:       { label: "Otro",           cls: "badge-gray" },
};
const ESTADOS: Record<string, { label: string; cls: string }> = {
  borrador:  { label: "Borrador",  cls: "badge-yellow" },
  aprobada:  { label: "Aprobada",  cls: "badge-green" },
  archivada: { label: "Archivada", cls: "badge-gray" },
};

const emptyForm = { fecha: "", tipo: "reunion", titulo: "", lugar: "", participantes: "", descripcion: "", resoluciones: "", proximas_acciones: "", estado: "borrador", responsable: "" };

export default function MinutasPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [minutas, setMinutas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search, tipo: tipoFilter });
    setMinutas(await (await fetch(`/api/minutas?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [search, tipoFilter]);

  const openEdit = (m: any) => {
    setForm({ fecha: m.fecha, tipo: m.tipo, titulo: m.titulo, lugar: m.lugar || "", participantes: m.participantes || "", descripcion: m.descripcion || "", resoluciones: m.resoluciones || "", proximas_acciones: m.proximas_acciones || "", estado: m.estado, responsable: m.responsable || "" });
    setEditId(m.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/minutas/${editId}` : "/api/minutas";
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta minuta?")) return;
    await fetch(`/api/minutas/${id}`, { method: "DELETE" });
    fetch_();
  };

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Minutas</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm, fecha: new Date().toISOString().split("T")[0] }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nueva minuta</button>}
        </div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ position: "relative", maxWidth: "360px", marginBottom: "20px" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input placeholder="Buscar por título, participantes..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
        </div>

        {loading ? <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Cargando...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {minutas.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>Sin minutas</div>
            ) : minutas.map(m => (
              <div key={m.id} style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(expanded === m.id ? null : m.id)}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flex: 1, minWidth: 0 }}>
                    {expanded === m.id ? <ChevronDown size={16} color="#6b7280" /> : <ChevronRight size={16} color="#6b7280" />}
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600" }}>{m.titulo}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                        {formatDate(m.fecha)}{m.lugar ? ` · ${m.lugar}` : ""}{m.responsable ? ` · ${m.responsable}` : ""}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
                    <span className={`badge ${TIPOS[m.tipo]?.cls || "badge-gray"}`}>{TIPOS[m.tipo]?.label || m.tipo}</span>
                    <span className={`badge ${ESTADOS[m.estado]?.cls || "badge-gray"}`}>{ESTADOS[m.estado]?.label || m.estado}</span>
                    {isAdmin && <>
                      <button onClick={e => { e.stopPropagation(); openEdit(m); }} style={iconBtn}><Edit2 size={13} /></button>
                      <button onClick={e => { e.stopPropagation(); handleDelete(m.id); }} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                    </>}
                  </div>
                </div>
                {expanded === m.id && (
                  <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)", padding: "16px 20px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {m.participantes && <div style={{ gridColumn: "span 2" }}><div style={secLabel}>Participantes</div><div style={secVal}>{m.participantes}</div></div>}
                    {m.descripcion && <div style={{ gridColumn: "span 2" }}><div style={secLabel}>Descripción / Agenda</div><div style={{ ...secVal, whiteSpace: "pre-wrap" }}>{m.descripcion}</div></div>}
                    {m.resoluciones && <div><div style={secLabel}>Resoluciones</div><div style={{ ...secVal, whiteSpace: "pre-wrap" }}>{m.resoluciones}</div></div>}
                    {m.proximas_acciones && <div><div style={secLabel}>Próximas acciones</div><div style={{ ...secVal, whiteSpace: "pre-wrap" }}>{m.proximas_acciones}</div></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "640px", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar minuta" : "Nueva minuta"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div><label style={lbl}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Título *</label><input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Título de la reunión" /></div>
              <div><label style={lbl}>Lugar</label><input value={form.lugar} onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} placeholder="Sala, videollamada..." /></div>
              <div><label style={lbl}>Responsable</label><input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Participantes</label>
                <textarea value={form.participantes} onChange={e => setForm(f => ({ ...f, participantes: e.target.value }))} rows={2} style={textarea} placeholder="Nombres separados por coma..." />
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Descripción / Agenda</label>
                <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={3} style={textarea} />
              </div>
              <div><label style={lbl}>Resoluciones</label>
                <textarea value={form.resoluciones} onChange={e => setForm(f => ({ ...f, resoluciones: e.target.value }))} rows={4} style={textarea} />
              </div>
              <div><label style={lbl}>Próximas acciones</label>
                <textarea value={form.proximas_acciones} onChange={e => setForm(f => ({ ...f, proximas_acciones: e.target.value }))} rows={4} style={textarea} />
              </div>
              {editId && <div><label style={lbl}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>}
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

const secLabel: React.CSSProperties = { fontSize: "11px", fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" };
const secVal: React.CSSProperties = { fontSize: "13px", color: "#374151" };
const lbl: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const textarea: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: "13px", border: "0.5px solid #e5e7eb", borderRadius: "8px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" };
const iconBtn: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: "7px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtn: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
