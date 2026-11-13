"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const ESTADOS: Record<string, { label: string; cls: string }> = {
  borrador:  { label: "Borrador",  cls: "badge-yellow" },
  aprobada:  { label: "Aprobada",  cls: "badge-blue" },
  pagada:    { label: "Pagada",    cls: "badge-green" },
};

const emptyForm = { empleado_id: "", periodo: "", salario_bruto: "", horas_extra: "0", bonificaciones: "0", descuento_jubilacion: "0", descuento_obra_social: "0", descuento_sindical: "0", otros_descuentos: "0", estado: "borrador", fecha_pago: "", notas: "" };

export default function LiquidacionesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [liquidaciones, setLiquidaciones] = useState<any[]>([]);
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ periodo: search });
    setLiquidaciones(await (await fetch(`/api/liquidaciones?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); setEmpleados([]); (async () => { setEmpleados(await (await fetch("/api/empleados?soloActivos=1")).json()); })(); }, [search]);

  const neto = () => {
    const bruto = (parseFloat(form.salario_bruto) || 0) + (parseFloat(form.horas_extra) || 0) + (parseFloat(form.bonificaciones) || 0);
    const desc = (parseFloat(form.descuento_jubilacion) || 0) + (parseFloat(form.descuento_obra_social) || 0) + (parseFloat(form.descuento_sindical) || 0) + (parseFloat(form.otros_descuentos) || 0);
    return bruto - desc;
  };

  const openEdit = (l: any) => {
    setForm({ empleado_id: String(l.empleado_id), periodo: l.periodo, salario_bruto: String(l.salario_bruto), horas_extra: String(l.horas_extra), bonificaciones: String(l.bonificaciones), descuento_jubilacion: String(l.descuento_jubilacion), descuento_obra_social: String(l.descuento_obra_social), descuento_sindical: String(l.descuento_sindical), otros_descuentos: String(l.otros_descuentos), estado: l.estado, fecha_pago: l.fecha_pago || "", notas: l.notas || "" });
    setEditId(l.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/liquidaciones/${editId}` : "/api/liquidaciones";
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta liquidación?")) return;
    await fetch(`/api/liquidaciones/${id}`, { method: "DELETE" });
    fetch_();
  };

  const totalNeto = liquidaciones.reduce((a, l) => a + l.neto, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Liquidaciones de Sueldos</div>
        {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nueva liquidación</button>}
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "240px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input placeholder="Filtrar por período..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
          </div>
          <div style={{ background: "white", borderRadius: "8px", padding: "8px 16px", border: "0.5px solid rgba(0,0,0,0.10)", fontSize: "13px", fontWeight: "600" }}>
            Total neto: {formatCurrency(totalNeto)}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead><tr><th>Empleado</th><th>Período</th><th style={{ textAlign: "right" }}>Bruto</th><th style={{ textAlign: "right" }}>Descuentos</th><th style={{ textAlign: "right" }}>Neto</th><th>Estado</th><th>Pago</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {liquidaciones.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin liquidaciones</td></tr>
                ) : liquidaciones.map(l => {
                  const bruto = l.salario_bruto + l.horas_extra + l.bonificaciones;
                  const desc = l.descuento_jubilacion + l.descuento_obra_social + l.descuento_sindical + l.otros_descuentos;
                  return (
                    <tr key={l.id}>
                      <td style={{ fontWeight: "500" }}>{l.empleado_nombre}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{l.periodo}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(bruto)}</td>
                      <td style={{ textAlign: "right", color: "#993C1D" }}>−{formatCurrency(desc)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>{formatCurrency(l.neto)}</td>
                      <td><span className={`badge ${ESTADOS[l.estado]?.cls || "badge-gray"}`}>{ESTADOS[l.estado]?.label || l.estado}</span></td>
                      <td style={{ fontSize: "12px" }}>{l.fecha_pago ? formatDate(l.fecha_pago) : "—"}</td>
                      {isAdmin && <td>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <button onClick={() => openEdit(l)} style={iconBtn}><Edit2 size={13} /></button>
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
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "580px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar liquidación" : "Nueva liquidación"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Empleado *</label>
                <select value={form.empleado_id} onChange={e => setForm(f => ({ ...f, empleado_id: e.target.value }))}>
                  <option value="">— seleccionar —</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.apellido}, {e.nombre}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Período *</label><input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="Ej: 2024/11" /></div>
              <div><label style={lbl}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2", borderTop: "0.5px solid #e5e7eb", paddingTop: "12px", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Haberes</div>
              <div><label style={lbl}>Salario bruto *</label><input type="number" value={form.salario_bruto} onChange={e => setForm(f => ({ ...f, salario_bruto: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Horas extra</label><input type="number" value={form.horas_extra} onChange={e => setForm(f => ({ ...f, horas_extra: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Bonificaciones</label><input type="number" value={form.bonificaciones} onChange={e => setForm(f => ({ ...f, bonificaciones: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div style={{ gridColumn: "span 2", borderTop: "0.5px solid #e5e7eb", paddingTop: "12px", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Descuentos</div>
              <div><label style={lbl}>Jubilación</label><input type="number" value={form.descuento_jubilacion} onChange={e => setForm(f => ({ ...f, descuento_jubilacion: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Obra social</label><input type="number" value={form.descuento_obra_social} onChange={e => setForm(f => ({ ...f, descuento_obra_social: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Sindical</label><input type="number" value={form.descuento_sindical} onChange={e => setForm(f => ({ ...f, descuento_sindical: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Otros descuentos</label><input type="number" value={form.otros_descuentos} onChange={e => setForm(f => ({ ...f, otros_descuentos: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div style={{ gridColumn: "span 2", background: "#f0fdf4", borderRadius: "8px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>Neto a pagar</span>
                <span style={{ fontSize: "18px", fontWeight: "800", color: "#0F6E56" }}>{formatCurrency(neto())}</span>
              </div>
              <div><label style={lbl}>Fecha de pago</label><input type="date" value={form.fecha_pago} onChange={e => setForm(f => ({ ...f, fecha_pago: e.target.value }))} /></div>
              <div><label style={lbl}>Notas</label><input value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
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
