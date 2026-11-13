"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Check, ChevronRight, ChevronDown, AlertTriangle, Loader2 } from "lucide-react";

const TIPOS = ["activo","pasivo","patrimonio","ingreso","egreso"];

const TIPO_COLOR: Record<string, { bg: string; color: string }> = {
  activo:     { bg: "#e8f0fa", color: "#185fa5" },
  pasivo:     { bg: "#f9ece7", color: "#993C1D" },
  patrimonio: { bg: "#e6f4f0", color: "#0F6E56" },
  ingreso:    { bg: "#e6f4f0", color: "#0F6E56" },
  egreso:     { bg: "#fef3e2", color: "#854F0B" },
};

const emptyForm = { codigo: "", nombre: "", tipo: "egreso", subtipo: "", parent_id: "", imputable: true, activo: true };

export default function PlanCuentasPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [cuentas, setCuentas] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ ...emptyForm });
  const [editId, setEditId]     = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/plan-cuentas");
    if (res.ok) setCuentas(await res.json());
    setLoading(false);
  };
  useEffect(() => { if (status === "authenticated") fetchData(); }, [status]);

  const handleSave = async () => {
    if (!form.codigo || !form.nombre || !form.tipo) { setError("Completá código, nombre y tipo"); return; }
    setSaving(true); setError("");
    const body = { ...form, parent_id: form.parent_id ? Number(form.parent_id) : null, imputable: form.imputable ? 1 : 0, activo: form.activo ? 1 : 0 };
    const url = editId ? `/api/plan-cuentas/${editId}` : "/api/plan-cuentas";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
    else { setShowForm(false); setEditId(null); fetchData(); }
    setSaving(false);
  };

  // Construir árbol
  const byParent: Record<string, any[]> = {};
  for (const c of cuentas) {
    const pid = c.parent_id ?? "root";
    if (!byParent[pid]) byParent[pid] = [];
    byParent[pid].push(c);
  }

  const toggle = (id: number) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  function renderNodo(c: any, nivel: number): React.ReactNode {
    const hijos = byParent[c.id] ?? [];
    const exp = expanded.has(c.id);
    const tc = TIPO_COLOR[c.tipo] ?? { bg: "#f0f2f5", color: "#6b7280" };
    return (
      <div key={c.id}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 16px 6px " + (16 + nivel*20) + "px", borderBottom: "0.5px solid #f0f2f5", background: nivel === 0 ? "#f7f8fa" : "white" }}>
          <span onClick={() => hijos.length > 0 && toggle(c.id)} style={{ cursor: hijos.length > 0 ? "pointer" : "default", color: "#9ca3af", width: "16px", flexShrink: 0 }}>
            {hijos.length > 0 ? (exp ? <ChevronDown size={13} /> : <ChevronRight size={13} />) : null}
          </span>
          <span style={{ fontFamily: "monospace", fontSize: "11px", color: "#9ca3af", minWidth: "60px" }}>{c.codigo}</span>
          <span style={{ fontWeight: nivel === 0 ? "700" : nivel === 1 ? "600" : "400", fontSize: "13px", flex: 1 }}>{c.nombre}</span>
          <span style={{ background: tc.bg, color: tc.color, padding: "1px 7px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>{c.tipo}</span>
          {!c.activo && <span style={{ background: "#f0f2f5", color: "#9ca3af", padding: "1px 7px", borderRadius: "10px", fontSize: "10px" }}>Inactiva</span>}
          {c.imputable ? <span style={{ background: "#e6f4f0", color: "#0F6E56", padding: "1px 7px", borderRadius: "10px", fontSize: "9px" }}>imputable</span> : null}
          {role === "admin" && (
            <button onClick={() => { setForm({ codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, subtipo: c.subtipo || "", parent_id: c.parent_id ? String(c.parent_id) : "", imputable: Boolean(c.imputable), activo: Boolean(c.activo) }); setEditId(Number(c.id)); setError(""); setShowForm(true); }}
              style={iconBtnSt}><Pencil size={12} /></button>
          )}
        </div>
        {exp && hijos.map(h => renderNodo(h, nivel + 1))}
      </div>
    );
  }

  const raices = byParent["root"] ?? [];

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Plan de cuentas</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Árbol jerárquico de cuentas contables. Los códigos deben ser únicos.</p>
        </div>
        {role === "admin" && (
          <button onClick={() => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); }} style={primaryBtnSt}>
            <Plus size={15} /> Nueva cuenta
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : raices.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Sin cuentas todavía</div>
        ) : (
          raices.map(r => renderNodo(r, 0))
        )}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>{editId ? "Editar cuenta" : "Nueva cuenta"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtnSt}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <label style={labelSt}>Código *</label>
                <input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="Ej: 5.1.06" disabled={!!editId} />
              </div>
              <div>
                <label style={labelSt}>Tipo *</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelSt}>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={labelSt}>Cuenta padre (código)</label>
                <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">— Sin padre (raíz) —</option>
                  {cuentas.filter(c => !c.imputable).map(c => <option key={c.id} value={c.id}>{c.codigo} – {c.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.imputable} onChange={e => setForm(f => ({ ...f, imputable: e.target.checked }))} /> Imputable
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} /> Activa
                </label>
              </div>
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
