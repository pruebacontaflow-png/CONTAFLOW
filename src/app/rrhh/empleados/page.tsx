"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const emptyForm = { nombre: "", apellido: "", cuit: "", cuil: "", cargo: "", departamento: "", fecha_ingreso: "", salario_base: "", banco: "", cbu: "", convenio: "", categoria: "", activo: true, notas: "" };

export default function EmpleadosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [empleados, setEmpleados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search, soloActivos: soloActivos ? "1" : "" });
    setEmpleados(await (await fetch(`/api/empleados?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [search, soloActivos]);

  const openEdit = (e: any) => {
    setForm({ nombre: e.nombre, apellido: e.apellido, cuit: e.cuit || "", cuil: e.cuil || "", cargo: e.cargo || "", departamento: e.departamento || "", fecha_ingreso: e.fecha_ingreso || "", salario_base: String(e.salario_base || ""), banco: e.banco || "", cbu: e.cbu || "", convenio: e.convenio || "", categoria: e.categoria || "", activo: e.activo === 1, notas: e.notas || "" });
    setEditId(e.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/empleados/${editId}` : "/api/empleados";
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, salario_base: parseFloat(form.salario_base) || 0, activo: form.activo ? 1 : 0 }) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Dar de baja a este empleado?")) return;
    await fetch(`/api/empleados/${id}`, { method: "DELETE" });
    fetch_();
  };

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Empleados</div>
        {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm, fecha_ingreso: new Date().toISOString().split("T")[0] }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nuevo empleado</button>}
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input placeholder="Buscar por nombre, cargo, CUIT..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", background: "white", padding: "8px 14px", borderRadius: "8px", border: "0.5px solid rgba(0,0,0,0.10)" }}>
            <input type="checkbox" checked={soloActivos} onChange={e => setSoloActivos(e.target.checked)} />
            Solo activos
          </label>
          <div style={{ background: "white", borderRadius: "8px", padding: "8px 16px", border: "0.5px solid rgba(0,0,0,0.10)", fontSize: "13px", fontWeight: "600" }}>
            {empleados.length} empleados
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead><tr><th>Apellido y nombre</th><th>Cargo</th><th>Depto.</th><th>Ingreso</th><th>CUIL</th><th style={{ textAlign: "right" }}>Salario base</th><th>Estado</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {empleados.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin empleados</td></tr>
                ) : empleados.map(e => (
                  <tr key={e.id}>
                    <td style={{ fontWeight: "600" }}>{e.apellido}, {e.nombre}</td>
                    <td>{e.cargo || "—"}</td>
                    <td style={{ color: "#6b7280" }}>{e.departamento || "—"}</td>
                    <td style={{ fontSize: "12px" }}>{e.fecha_ingreso ? formatDate(e.fecha_ingreso) : "—"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{e.cuil || e.cuit || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{e.salario_base > 0 ? formatCurrency(e.salario_base) : "—"}</td>
                    <td><span className={`badge ${e.activo ? "badge-green" : "badge-gray"}`}>{e.activo ? "Activo" : "Baja"}</span></td>
                    {isAdmin && <td>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(e)} style={iconBtn}><Edit2 size={13} /></button>
                        {e.activo === 1 && <button onClick={() => handleDelete(e.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>}
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
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "580px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar empleado" : "Nuevo empleado"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Nombre *</label><input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div><label style={lbl}>Apellido *</label><input value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} /></div>
              <div><label style={lbl}>CUIT</label><input value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} placeholder="20-12345678-9" /></div>
              <div><label style={lbl}>CUIL</label><input value={form.cuil} onChange={e => setForm(f => ({ ...f, cuil: e.target.value }))} placeholder="20-12345678-9" /></div>
              <div><label style={lbl}>Cargo</label><input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} /></div>
              <div><label style={lbl}>Departamento</label><input value={form.departamento} onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))} /></div>
              <div><label style={lbl}>Fecha ingreso</label><input type="date" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))} /></div>
              <div><label style={lbl}>Salario base</label><input type="number" value={form.salario_base} onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Banco</label><input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} /></div>
              <div><label style={lbl}>CBU</label><input value={form.cbu} onChange={e => setForm(f => ({ ...f, cbu: e.target.value }))} placeholder="22 dígitos" /></div>
              <div><label style={lbl}>Convenio</label><input value={form.convenio} onChange={e => setForm(f => ({ ...f, convenio: e.target.value }))} placeholder="Ej: CCT 130/75" /></div>
              <div><label style={lbl}>Categoría</label><input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} /></div>
              {editId && (
                <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" id="activo_emp" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                  <label htmlFor="activo_emp" style={{ fontSize: "13px", fontWeight: "500" }}>Empleado activo</label>
                </div>
              )}
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
