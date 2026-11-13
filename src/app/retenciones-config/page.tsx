"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Check, Loader2, AlertTriangle } from "lucide-react";

const TIPOS = [
  { value: "ganancias_sicore", label: "Ganancias SICORE" },
  { value: "iibb_agip",        label: "IIBB AGIP (CABA)" },
  { value: "iibb_arba",        label: "IIBB ARBA (Pcia. Bs.As.)" },
  { value: "iibb_otro",        label: "IIBB otra jurisdicción" },
  { value: "otro",             label: "Otro" },
];

const emptyForm = {
  tipo: "ganancias_sicore", descripcion: "", codigo_regimen: "",
  alicuota: "", minimo_no_imponible: "0", acumula_mensual: true, activo: true,
};

export default function RetencionesConfigPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/retenciones-config");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  };

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status]);

  const handleSave = async () => {
    if (!form.descripcion || !form.alicuota) { setError("Completá descripción y alícuota"); return; }
    setSaving(true); setError("");
    const body = {
      tipo: form.tipo,
      descripcion: form.descripcion,
      codigo_regimen: form.codigo_regimen,
      alicuota: parseFloat(form.alicuota) / 100,
      minimo_no_imponible: parseFloat(form.minimo_no_imponible) || 0,
      acumula_mensual: form.acumula_mensual ? 1 : 0,
      activo: form.activo ? 1 : 0,
    };
    const url = editId ? `/api/retenciones-config/${editId}` : "/api/retenciones-config";
    const method = editId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); }
    else { setShowForm(false); setEditId(null); fetchData(); }
    setSaving(false);
  };

  const handleEdit = (row: any) => {
    setForm({
      tipo: row.tipo, descripcion: row.descripcion, codigo_regimen: row.codigo_regimen || "",
      alicuota: (Number(row.alicuota) * 100).toFixed(2),
      minimo_no_imponible: String(row.minimo_no_imponible ?? 0),
      acumula_mensual: Boolean(row.acumula_mensual), activo: Boolean(row.activo),
    });
    setEditId(Number(row.id));
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    await fetch(`/api/retenciones-config/${id}`, { method: "DELETE" });
    fetchData();
  };

  const tipoLabel = (t: string) => TIPOS.find(x => x.value === t)?.label ?? t;

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Configuración de retenciones</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Alícuotas y regímenes usados al calcular retenciones en órdenes de pago. Sin valores hardcodeados.
          </p>
        </div>
        {role === "admin" && (
          <button
            onClick={() => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); }}
            style={{ display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}
          >
            <Plus size={15} /> Nuevo régimen
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Código régimen</th>
                <th style={{ textAlign: "right" }}>Alícuota</th>
                <th style={{ textAlign: "right" }}>Mínimo no imponible</th>
                <th>Acumula mensual</th>
                <th>Estado</th>
                {role === "admin" && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  <td><span style={{ background: "#e8f0fa", color: "#185fa5", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>{tipoLabel(row.tipo)}</span></td>
                  <td style={{ fontWeight: "500" }}>{row.descripcion}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{row.codigo_regimen || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: "700" }}>{(Number(row.alicuota) * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: "right" }}>{Number(row.minimo_no_imponible) > 0 ? `$${Number(row.minimo_no_imponible).toLocaleString("es-AR")}` : "—"}</td>
                  <td style={{ textAlign: "center" }}>{row.acumula_mensual ? "✓" : "—"}</td>
                  <td>
                    <span style={{ background: row.activo ? "#e6f4f0" : "#f0f2f5", color: row.activo ? "#0F6E56" : "#9ca3af", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "700" }}>
                      {row.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  {role === "admin" && (
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => handleEdit(row)} style={iconBtnSt} title="Editar"><Pencil size={13} /></button>
                        <button onClick={() => handleDelete(Number(row.id))} style={{ ...iconBtnSt, color: "#993C1D" }} title="Eliminar"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  )}
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
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>{editId ? "Editar régimen" : "Nuevo régimen"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtnSt}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelSt}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={labelSt}>Descripción *</label>
                <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: Ganancias - Servicios (RG 830)" />
              </div>
              <div>
                <label style={labelSt}>Código régimen SICORE</label>
                <input value={form.codigo_regimen} onChange={e => setForm(f => ({ ...f, codigo_regimen: e.target.value }))} placeholder="Ej: 067" />
              </div>
              <div>
                <label style={labelSt}>Alícuota % *</label>
                <input type="number" step="0.01" value={form.alicuota} onChange={e => setForm(f => ({ ...f, alicuota: e.target.value }))} placeholder="Ej: 6" />
              </div>
              <div>
                <label style={labelSt}>Mínimo no imponible $</label>
                <input type="number" value={form.minimo_no_imponible} onChange={e => setForm(f => ({ ...f, minimo_no_imponible: e.target.value }))} placeholder="0" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", justifyContent: "flex-end" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.acumula_mensual} onChange={e => setForm(f => ({ ...f, acumula_mensual: e.target.checked }))} />
                  Acumula mensualmente
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                  Activo
                </label>
              </div>
            </div>
            {error && (
              <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "9px 14px", color: "#993C1D", fontSize: "13px", marginTop: "12px", display: "flex", gap: "8px" }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtnSt}>
                {saving ? <Loader2 size={14} /> : <Check size={14} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtnSt: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSt: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
