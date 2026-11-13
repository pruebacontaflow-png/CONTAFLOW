"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const ESTADOS: Record<string, { label: string; cls: string }> = {
  pendiente: { label: "Pendiente", cls: "badge-yellow" },
  aprobada:  { label: "Aprobada",  cls: "badge-blue" },
  pagada:    { label: "Pagada",    cls: "badge-green" },
  "sin factura": { label: "Sin factura", cls: "badge-red" },
};

const emptyForm = { acuerdo_id: "", empleado: "", periodo: "", base_calculo: "", porcentaje: "", importe: "", estado: "pendiente", fecha_pago: "", notas: "" };

export default function ComisionesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [comisiones, setComisiones] = useState<any[]>([]);
  const [acuerdos, setAcuerdos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ estado: estadoFilter });
    setComisiones(await (await fetch(`/api/comisiones?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [estadoFilter]);
  useEffect(() => { (async () => { setAcuerdos(await (await fetch("/api/acuerdos-comerciales?estado=activo")).json()); })(); }, []);

  const calcImporte = () => {
    const base = parseFloat(form.base_calculo) || 0;
    const pct = parseFloat(form.porcentaje) || 0;
    return base * pct / 100;
  };

  const openEdit = (c: any) => {
    setForm({ acuerdo_id: c.acuerdo_id ? String(c.acuerdo_id) : "", empleado: c.empleado, periodo: c.periodo, base_calculo: String(c.base_calculo || ""), porcentaje: String(c.porcentaje || ""), importe: String(c.importe || ""), estado: c.estado, fecha_pago: c.fecha_pago || "", notas: c.notas || "" });
    setEditId(c.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/comisiones/${editId}` : "/api/comisiones";
    const body = { ...form, acuerdo_id: form.acuerdo_id ? parseInt(form.acuerdo_id) : null, base_calculo: parseFloat(form.base_calculo) || 0, porcentaje: parseFloat(form.porcentaje) || 0, importe: parseFloat(form.importe) || calcImporte() };
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta comisión?")) return;
    await fetch(`/api/comisiones/${id}`, { method: "DELETE" });
    fetch_();
  };

  const totalPendiente = comisiones.filter(c => c.estado === "pendiente").reduce((a, c) => a + c.importe, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Comisiones</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nueva comisión</button>}
        </div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ background: "#f0f6fc", borderRadius: "10px", padding: "12px 18px", marginBottom: "16px", border: "0.5px solid #c9dcf0", fontSize: "12px", color: "#1f3b5a" }}>
          <b>Cálculo:</b> 10% de (facturación emitida del mes − gastos del área comercial), repartido entre los 2 comerciales. Desde el 01/05/2025 se paga según el cumplimiento de la proyección: 0% a 60% → 0% · 61% a 85% → 50% · 86% a 95% → 70% · 96% a 110% → 100% · más de 110% → 150%. Todos los acuerdos los lleva Leandro Dahlman; en 2025 la comisión se divide en partes iguales con Diego Waciarz. Fee mensual de Leandro: $1.000.000 desde mayo 2025 (factura mensual "Sueldo" en Proveedores).
        </div>
        {comisiones.length > 0 && (
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
            {Array.from(new Set(comisiones.map(c => c.empleado))).map(emp => {
              const rows = comisiones.filter(c => c.empleado === emp);
              const total = rows.reduce((a, c) => a + (c.importe || 0), 0);
              const pagado = rows.filter(c => c.estado === "pagada").reduce((a, c) => a + (c.importe || 0), 0);
              return (
                <div key={emp} style={{ background: "white", borderRadius: "10px", border: "0.5px solid rgba(0,0,0,0.10)", padding: "12px 18px", minWidth: "240px" }}>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>{emp}</div>
                  <div style={{ fontSize: "16px", fontWeight: 700 }}>{formatCurrency(total)}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Facturado y pagado: {formatCurrency(pagado)} · Sin factura: {rows.filter(c => c.estado === "sin factura").length} período(s)</div>
                </div>
              );
            })}
          </div>
        )}
        {totalPendiente > 0 && (
          <div style={{ background: "#fef9c3", borderRadius: "10px", padding: "12px 20px", marginBottom: "20px", border: "0.5px solid #fde68a", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: "13px", color: "#854F0B" }}>Comisiones pendientes de pago</span>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#854F0B" }}>{formatCurrency(totalPendiente)}</span>
          </div>
        )}

        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead><tr><th>Comercial</th><th>Período</th><th style={{ textAlign: "right" }}>Base (ingresos − gastos)</th><th style={{ textAlign: "right" }}>% comisión</th><th style={{ textAlign: "right" }}>% cumplimiento</th><th style={{ textAlign: "right" }}>Importe</th><th>Estado</th><th>Pago</th><th>Factura / observaciones</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {comisiones.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin comisiones</td></tr>
                ) : comisiones.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: "500" }}>{c.empleado}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{c.periodo}</td>
                    <td style={{ textAlign: "right" }}>{c.base_calculo > 0 ? formatCurrency(c.base_calculo) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{c.porcentaje > 0 ? `${c.porcentaje}%` : "—"}{c.pct_comision != null && c.pct_comision !== 100 ? <div style={{ fontSize: "11px", color: "#6b7280" }}>factor {c.pct_comision}%</div> : null}</td>
                    <td style={{ textAlign: "right" }}>{c.pct_cumplimiento != null ? `${Number(c.pct_cumplimiento).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{formatCurrency(c.importe)}</td>
                    <td><span className={`badge ${ESTADOS[c.estado]?.cls || "badge-gray"}`}>{ESTADOS[c.estado]?.label || c.estado}</span></td>
                    <td style={{ fontSize: "12px" }}>{c.fecha_pago ? formatDate(c.fecha_pago) : "—"}</td>
                    <td style={{ fontSize: "12px", color: c.coincide_factura === 0 || c.estado === "sin factura" ? "#993C1D" : "#6b7280", maxWidth: "340px" }}>{c.notas || "—"}</td>
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
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar comisión" : "Nueva comisión"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Empleado *</label><input value={form.empleado} onChange={e => setForm(f => ({ ...f, empleado: e.target.value }))} placeholder="Nombre del empleado" /></div>
              <div><label style={lbl}>Período *</label><input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="Ej: 2024/11" /></div>
              <div><label style={lbl}>Acuerdo</label>
                <select value={form.acuerdo_id} onChange={e => setForm(f => ({ ...f, acuerdo_id: e.target.value }))}>
                  <option value="">— sin acuerdo —</option>
                  {acuerdos.map(a => <option key={a.id} value={a.id}>{a.descripcion}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Base de cálculo</label>
                <input type="number" value={form.base_calculo} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, base_calculo: v, importe: String(parseFloat(v) * parseFloat(f.porcentaje || "0") / 100 || 0) })); }} placeholder="0.00" step="0.01" />
              </div>
              <div><label style={lbl}>Porcentaje (%)</label>
                <input type="number" value={form.porcentaje} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, porcentaje: v, importe: String(parseFloat(f.base_calculo || "0") * parseFloat(v) / 100 || 0) })); }} placeholder="0" step="0.5" />
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Importe</label>
                <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "10px 14px", fontSize: "16px", fontWeight: "700", color: "#0F6E56" }}>
                  {formatCurrency(parseFloat(form.importe) || calcImporte())}
                </div>
              </div>
              <div><label style={lbl}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Fecha de pago</label><input type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Notas</label><input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
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
