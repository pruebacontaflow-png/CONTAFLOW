"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X, AlertTriangle, Loader2, ToggleLeft, ToggleRight } from "lucide-react";

const TIPO_MATCH_OPS = [
  { val: "contiene", label: "Contiene" },
  { val: "empieza",  label: "Empieza con" },
  { val: "termina",  label: "Termina en" },
  { val: "exacto",   label: "Es exactamente" },
];

const emptyForm = { nombre: "", patron: "", tipo_match: "contiene", categoria: "", cuenta_contable_id: "", descripcion_reemplazo: "", prioridad: "0", activo: true };

export default function ReglasClasificacionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [reglas, setReglas]     = useState<any[]>([]);
  const [cuentas, setCuentas]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...emptyForm });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = async () => {
    setLoading(true);
    const [r, c] = await Promise.all([
      fetch("/api/reglas-clasificacion").then(res => res.ok ? res.json() : []),
      fetch("/api/plan-cuentas").then(res => res.ok ? res.json() : []),
    ]);
    setReglas(r);
    setCuentas(c.filter((c: any) => c.imputable && c.activo));
    setLoading(false);
  };
  useEffect(() => { if (status === "authenticated") fetchData(); }, [status]);

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.patron.trim()) { setError("Nombre y patrón son obligatorios"); return; }
    setSaving(true); setError("");
    const body = { ...form, cuenta_contable_id: form.cuenta_contable_id ? Number(form.cuenta_contable_id) : null, activo: form.activo ? 1 : 0 };
    const url    = editId ? `/api/reglas-clasificacion/${editId}` : "/api/reglas-clasificacion";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
    else { setShowForm(false); setEditId(null); fetchData(); }
    setSaving(false);
  };

  const handleToggleActivo = async (regla: any) => {
    await fetch(`/api/reglas-clasificacion/${regla.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...regla, activo: regla.activo ? 0 : 1 }),
    });
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    await fetch(`/api/reglas-clasificacion/${id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Reglas de clasificación</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Se aplican al importar extractos y al ejecutar "Aplicar reglas". Orden: mayor prioridad primero.
          </p>
        </div>
        {role === "admin" && (
          <button onClick={() => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); }} style={primaryBtnSt}>
            <Plus size={15} /> Nueva regla
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : reglas.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>Sin reglas definidas</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ textAlign: "center" }}>Prioridad</th>
                <th>Nombre</th>
                <th>Patrón</th>
                <th>Tipo</th>
                <th>Categoría</th>
                <th>Cuenta contable</th>
                <th style={{ textAlign: "center" }}>Activa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((r: any) => (
                <tr key={r.id} style={{ opacity: r.activo ? 1 : 0.5 }}>
                  <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "12px" }}>{r.prioridad}</td>
                  <td style={{ fontWeight: "600" }}>{r.nombre}</td>
                  <td>
                    <span style={{ background: "#f0f2f5", padding: "1px 8px", borderRadius: "5px", fontFamily: "monospace", fontSize: "12px" }}>
                      {r.patron}
                    </span>
                  </td>
                  <td>
                    <span style={{ background: "#e8f0fa", color: "#185fa5", padding: "1px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>
                      {TIPO_MATCH_OPS.find(t => t.val === r.tipo_match)?.label ?? r.tipo_match}
                    </span>
                  </td>
                  <td>
                    {r.categoria ? (
                      <span style={{ background: "#fef3e2", color: "#854F0B", padding: "1px 8px", borderRadius: "10px", fontSize: "11px" }}>{r.categoria}</span>
                    ) : "—"}
                  </td>
                  <td style={{ fontSize: "12px" }}>
                    {r.cuenta_codigo ? `${r.cuenta_codigo} – ${r.cuenta_nombre}` : "—"}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {role === "admin" ? (
                      <button onClick={() => handleToggleActivo(r)} style={{ background: "none", border: "none", cursor: "pointer", color: r.activo ? "#0F6E56" : "#9ca3af" }}>
                        {r.activo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                      </button>
                    ) : (
                      r.activo ? <span style={{ color: "#0F6E56", fontSize: "12px" }}>Sí</span> : <span style={{ color: "#9ca3af", fontSize: "12px" }}>No</span>
                    )}
                  </td>
                  <td>
                    {role === "admin" && (
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => { setForm({ nombre: r.nombre, patron: r.patron, tipo_match: r.tipo_match, categoria: r.categoria || "", cuenta_contable_id: r.cuenta_contable_id ? String(r.cuenta_contable_id) : "", descripcion_reemplazo: r.descripcion_reemplazo || "", prioridad: String(r.prioridad), activo: Boolean(r.activo) }); setEditId(r.id); setError(""); setShowForm(true); }} style={iconBtnSt}><Pencil size={12} /></button>
                        <button onClick={() => handleDelete(r.id)} style={{ ...iconBtnSt, color: "#993C1D" }}><Trash2 size={12} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>{editId ? "Editar regla" : "Nueva regla"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtnSt}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Débito bancario" />
                </div>
                <div>
                  <label style={labelSt}>Prioridad</label>
                  <input type="number" value={form.prioridad} onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Patrón de texto *</label>
                  <input value={form.patron} onChange={e => setForm(f => ({ ...f, patron: e.target.value }))} placeholder="Ej: DEBITO AUTOMATICO" />
                </div>
                <div>
                  <label style={labelSt}>Tipo de match</label>
                  <select value={form.tipo_match} onChange={e => setForm(f => ({ ...f, tipo_match: e.target.value }))}>
                    {TIPO_MATCH_OPS.map(t => <option key={t.val} value={t.val}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Categoría</label>
                  <input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ej: Gastos bancarios" />
                </div>
                <div>
                  <label style={labelSt}>Cuenta contable</label>
                  <select value={form.cuenta_contable_id} onChange={e => setForm(f => ({ ...f, cuenta_contable_id: e.target.value }))}>
                    <option value="">— Sin cuenta —</option>
                    {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.codigo} – {c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} /> Activa
              </label>
            </div>
            {error && <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "9px 14px", color: "#993C1D", fontSize: "13px", marginTop: "12px", display: "flex", gap: "8px" }}><AlertTriangle size={15} />{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtnSt}>{saving ? <Loader2 size={14} /> : <Check size={14} />} Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtnSt: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSt: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
