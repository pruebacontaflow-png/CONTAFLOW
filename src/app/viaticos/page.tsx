"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPOS = ["Combustible", "Peaje", "Comida", "Alojamiento", "Transporte", "Otros"];

const emptyForm = { empleado: "", fecha: "", tipo: "", descripcion: "", importe: "", moneda: "ARS", comprobante_numero: "" };

export default function ViaticosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [viaticos, setViaticos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [soloNoAprobados, setSoloNoAprobados] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search, soloNoAprobados: soloNoAprobados ? "1" : "" });
    setViaticos(await (await fetch(`/api/viaticos?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [search, soloNoAprobados]);

  const openEdit = (v: any) => {
    setForm({ empleado: v.empleado, fecha: v.fecha, tipo: v.tipo, descripcion: v.descripcion || "", importe: String(v.importe), moneda: v.moneda, comprobante_numero: v.comprobante_numero || "" });
    setEditId(v.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/viaticos/${editId}` : "/api/viaticos";
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, importe: parseFloat(form.importe) || 0 }) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este viático?")) return;
    await fetch(`/api/viaticos/${id}`, { method: "DELETE" });
    fetch_();
  };

  const handleAprobar = async (id: number, aprobado: boolean) => {
    await fetch(`/api/viaticos/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aprobado: aprobado ? 1 : 0 }) });
    fetch_();
  };

  const totalPendiente = viaticos.filter(v => !v.aprobado).reduce((a, v) => a + v.importe, 0);
  const totalAprobado = viaticos.filter(v => v.aprobado).reduce((a, v) => a + v.importe, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Viáticos</div>
        {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm, fecha: new Date().toISOString().split("T")[0] }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nuevo viático</button>}
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "16px 20px", border: "0.5px solid rgba(0,0,0,0.10)" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Pendiente de aprobación</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#854F0B" }}>{formatCurrency(totalPendiente)}</div>
          </div>
          <div style={{ background: "white", borderRadius: "12px", padding: "16px 20px", border: "0.5px solid rgba(0,0,0,0.10)" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "6px" }}>Aprobado</div>
            <div style={{ fontSize: "22px", fontWeight: "700", color: "#0F6E56" }}>{formatCurrency(totalAprobado)}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input placeholder="Buscar por empleado, tipo..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", background: "white", padding: "8px 14px", borderRadius: "8px", border: "0.5px solid rgba(0,0,0,0.10)" }}>
            <input type="checkbox" checked={soloNoAprobados} onChange={e => setSoloNoAprobados(e.target.checked)} />
            Solo pendientes de aprobación
          </label>
        </div>

        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead>
                <tr><th>Empleado</th><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Rendición</th><th>Pago</th><th>Estado</th><th style={{ textAlign: "right" }}>Importe</th>{isAdmin && <th></th>}</tr>
              </thead>
              <tbody>
                {viaticos.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin viáticos</td></tr>
                ) : viaticos.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: "500" }}>{v.empleado}</td>
                    <td style={{ fontSize: "12px" }}>{formatDate(v.fecha)}</td>
                    <td><span className="badge badge-blue">{v.tipo}</span></td>
                    <td style={{ color: "#6b7280", fontSize: "13px" }}>{v.descripcion || "—"}</td>
                    <td style={{ fontSize: "12px" }}>
                      {v.archivo_adjunto ? <a href={`/api/archivo?path=${encodeURIComponent(v.archivo_adjunto)}`} target="_blank" rel="noreferrer" style={{ color: "#185fa5" }}>{String(v.archivo_adjunto).split("/").pop()}</a> : "—"}
                      {v.total_rendicion ? <div style={{ color: "#6b7280" }}>Total rendición: {formatCurrency(v.total_rendicion)}</div> : null}
                      {v.observacion ? <div style={{ color: "#854F0B" }}>{v.observacion}</div> : null}
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {v.medio_pago === "efectivo" ? "Efectivo" + (v.caja_mov_id ? " (caja chica)" : "") : v.medio_pago === "transferencia" ? "Transferencia" : "—"}
                      {v.factura_id ? <div style={{ color: "#6b7280" }}>Con factura</div> : null}
                    </td>
                    <td>
                      {v.aprobado
                        ? <span className="badge badge-green">Aprobado</span>
                        : <span className="badge badge-yellow">Pendiente</span>
                      }
                    </td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{v.moneda !== "ARS" ? `${v.moneda} ` : ""}{formatCurrency(v.importe)}</td>
                    {isAdmin && <td>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        {!v.aprobado && (
                          <button onClick={() => handleAprobar(v.id, true)} style={{ ...iconBtn, color: "#0F6E56" }} title="Aprobar"><CheckCircle size={13} /></button>
                        )}
                        {v.aprobado && (
                          <button onClick={() => handleAprobar(v.id, false)} style={{ ...iconBtn, color: "#854F0B" }} title="Desaprobar"><X size={13} /></button>
                        )}
                        <button onClick={() => openEdit(v)} style={iconBtn}><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(v.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
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
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar viático" : "Nuevo viático"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Empleado *</label><input value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado: e.target.value }))} placeholder="Nombre del empleado" /></div>
              <div><label style={lbl}>Fecha *</label><input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div><label style={lbl}>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="">— seleccionar —</option>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Importe *</label><input type="number" value={form.importe} onChange={e => setForm(f => ({ ...f, importe: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Descripción</label><input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Detalle del viático" /></div>
              <div><label style={lbl}>N° comprobante</label><input value={form.comprobante_numero} onChange={e => setForm(f => ({ ...f, comprobante_numero: e.target.value }))} placeholder="Opcional" /></div>
              <div><label style={lbl}>Moneda</label>
                <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
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
