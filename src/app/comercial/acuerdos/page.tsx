"use client";

import { Fragment, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPOS = ["servicio", "producto", "licencia", "mantenimiento", "otro"];
const ESTADOS: Record<string, { label: string; cls: string }> = {
  activo:    { label: "Activo",    cls: "badge-green" },
  suspendido: { label: "Suspendido", cls: "badge-yellow" },
  finalizado: { label: "Finalizado", cls: "badge-gray" },
};

const emptyForm = { cliente_id: "", descripcion: "", tipo: "servicio", fecha_inicio: "", fecha_fin: "", importe_mensual: "", moneda: "ARS", comision_pct: "", responsable: "", estado: "activo", notas: "" };

export default function AcuerdosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [abierto, setAbierto] = useState<number | null>(null);
  const [acuerdos, setAcuerdos] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("activo");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search, estado: estadoFilter });
    setAcuerdos(await (await fetch(`/api/acuerdos-comerciales?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetch_(); }, [search, estadoFilter]);
  useEffect(() => { (async () => { setClientes(await (await fetch("/api/clientes")).json()); })(); }, []);

  const openEdit = (a: any) => {
    setForm({ cliente_id: a.cliente_id ? String(a.cliente_id) : "", descripcion: a.descripcion, tipo: a.tipo, fecha_inicio: a.fecha_inicio || "", fecha_fin: a.fecha_fin || "", importe_mensual: String(a.importe_mensual || ""), moneda: a.moneda, comision_pct: String(a.comision_pct || ""), responsable: a.responsable || "", estado: a.estado, notas: a.notas || "" });
    setEditId(a.id); setError(""); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError("");
    const url = editId ? `/api/acuerdos-comerciales/${editId}` : "/api/acuerdos-comerciales";
    const res = await fetch(url, { method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, cliente_id: form.cliente_id ? parseInt(form.cliente_id) : null, importe_mensual: parseFloat(form.importe_mensual) || 0, comision_pct: parseFloat(form.comision_pct) || 0 }) });
    if (res.ok) { setShowForm(false); fetch_(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este acuerdo?")) return;
    await fetch(`/api/acuerdos-comerciales/${id}`, { method: "DELETE" });
    fetch_();
  };

  const totalMensual = acuerdos.filter(a => a.estado === "activo").reduce((s, a) => s + a.importe_mensual, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Acuerdos Comerciales</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
            <option value="">Todos</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {isAdmin && <button className="btn-primary" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setError(""); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}><Plus size={14} /> Nuevo acuerdo</button>}
        </div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input placeholder="Buscar por descripción, cliente, responsable..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
          </div>
          {totalMensual > 0 && <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "8px 16px", border: "0.5px solid #bbf7d0", fontSize: "13px", fontWeight: "600", color: "#0F6E56" }}>
            Recurrente mensual: {formatCurrency(totalMensual)}
          </div>}
        </div>

        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
            <table className="data-table">
              <thead><tr><th></th><th>Acuerdo</th><th>Cliente</th><th>Vigencia</th><th>Facturado por</th><th>Plazo de pago</th><th style={{ textAlign: "right" }}>Importe/mes</th><th style={{ textAlign: "right" }}>Canje/mes</th><th>Estado</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {acuerdos.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin acuerdos</td></tr>
                ) : acuerdos.map(a => (
                  <Fragment key={a.id}>
                  <tr onClick={() => setAbierto(abierto === a.id ? null : a.id)} style={{ cursor: "pointer" }}>
                    <td style={{ width: "24px", color: "#6b7280" }}>{abierto === a.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                    <td style={{ fontWeight: "500" }}>{a.campania || a.descripcion}{a.nro_oc ? <div style={{ fontSize: "11px", color: "#6b7280" }}>OC {String(a.nro_oc).replace(/\.0$/, "")}</div> : null}</td>
                    <td style={{ color: "#6b7280" }}>{a.cliente_nombre || a.cliente_original || "—"}</td>
                    <td style={{ fontSize: "12px" }}>
                      {a.fecha_inicio ? formatDate(a.fecha_inicio) : "—"}
                      {a.fecha_fin && <> → {formatDate(a.fecha_fin)}</>}
                    </td>
                    <td style={{ fontSize: "12px", color: "#6b7280" }}>{a.facturado_por || "—"}</td>
                    <td style={{ fontSize: "12px", color: "#6b7280" }}>{a.plazo_pago || "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{a.importe_mensual > 0 ? `${a.moneda !== "ARS" ? a.moneda + " " : ""}${formatCurrency(a.importe_mensual)}` : a.importe_total_acuerdo > 0 ? `${a.moneda} ${formatCurrency(a.importe_total_acuerdo)} total` : "—"}</td>
                    <td style={{ textAlign: "right", color: "#6b7280" }}>{a.importe_canje > 0 ? formatCurrency(a.importe_canje) : "—"}</td>
                    <td><span className={`badge ${ESTADOS[a.estado]?.cls || "badge-gray"}`}>{ESTADOS[a.estado]?.label || a.estado}</span></td>
                    {isAdmin && <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEdit(a)} style={iconBtn}><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(a.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                      </div>
                    </td>}
                  </tr>
                  {abierto === a.id && (
                    <tr><td colSpan={10} style={{ background: "#f9fafb", padding: "16px 20px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>Datos de la campaña (según acuerdo firmado)</div>
                          <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "12px", color: "#374151", margin: 0 }}>{a.detalle || a.notas || "—"}</pre>
                          {a.archivo_word ? <div style={{ marginTop: "8px", fontSize: "12px" }}><a href={`/api/archivo?path=${encodeURIComponent("datos/2025/comercial/" + a.archivo_word)}`} style={{ color: "#185fa5" }}>Descargar acuerdo (Word)</a></div> : null}
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>Desglose mensual (planilla de comisiones)</div>
                          {a.presupuesto?.length ? (
                            <table className="data-table" style={{ fontSize: "12px" }}>
                              <thead><tr><th>Mes</th><th style={{ textAlign: "right" }}>Proyectado</th><th style={{ textAlign: "right" }}>Real</th><th style={{ textAlign: "right" }}>Gastos</th></tr></thead>
                              <tbody>
                                {a.presupuesto.map((p: any) => (
                                  <tr key={p.periodo}><td>{p.periodo}</td><td style={{ textAlign: "right" }}>{formatCurrency(p.ingresos_proyectados || 0)}</td><td style={{ textAlign: "right" }}>{formatCurrency(p.ingresos_reales || 0)}</td><td style={{ textAlign: "right" }}>{formatCurrency(p.gastos_comerciales || 0)}</td></tr>
                                ))}
                                <tr style={{ fontWeight: 700 }}><td>Total</td>
                                  <td style={{ textAlign: "right" }}>{formatCurrency(a.presupuesto.reduce((t: number, p: any) => t + (p.ingresos_proyectados || 0), 0))}</td>
                                  <td style={{ textAlign: "right" }}>{formatCurrency(a.presupuesto.reduce((t: number, p: any) => t + (p.ingresos_reales || 0), 0))}</td>
                                  <td style={{ textAlign: "right" }}>{formatCurrency(a.presupuesto.reduce((t: number, p: any) => t + (p.gastos_comerciales || 0), 0))}</td></tr>
                              </tbody>
                            </table>
                          ) : <div style={{ fontSize: "12px", color: "#9ca3af" }}>Sin datos en la planilla de comisiones para este cliente</div>}
                          <div style={{ fontSize: "12px", fontWeight: 700, margin: "14px 0 6px" }}>Facturas emitidas al cliente</div>
                          {a.facturas?.length ? a.facturas.map((f: any) => (
                            <div key={f.id} style={{ fontSize: "12px", display: "flex", justifyContent: "space-between", borderBottom: "0.5px solid #e5e7eb", padding: "3px 0" }}>
                              <span>{formatDate(f.fecha_emision)} · {f.tipo_comprobante} {String(f.punto_venta || "").padStart(5, "0")}-{String(f.numero || "").padStart(8, "0")}</span>
                              <span>{formatCurrency(f.total)} · {f.estado === "cobrada" ? `cobrada ${formatDate(f.fecha_cobro)}` : f.estado === "anulada" ? "anulada (NC)" : "pendiente"}</span>
                            </div>
                          )) : <div style={{ fontSize: "12px", color: "#9ca3af" }}>{a.facturado_por?.includes("efectivo") ? "Se cobra en efectivo (caja chica)" : "Sin facturas asociadas"}</div>}
                        </div>
                      </div>
                    </td></tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "560px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editId ? "Editar acuerdo" : "Nuevo acuerdo"}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Descripción *</label><input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Nombre o descripción del acuerdo" /></div>
              <div><label style={lbl}>Cliente</label>
                <select value={form.cliente_id} onChange={e => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">— sin cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Tipo</label>
                <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Inicio vigencia</label><input type="date" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
              <div><label style={lbl}>Fin vigencia</label><input type="date" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} /></div>
              <div><label style={lbl}>Importe mensual</label><input type="number" value={form.importe_mensual} onChange={e => setForm(f => ({ ...f, importe_mensual: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Moneda</label>
                <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
              <div><label style={lbl}>Comisión (%)</label><input type="number" value={form.comision_pct} onChange={e => setForm(f => ({ ...f, comision_pct: e.target.value }))} placeholder="0" step="0.5" /></div>
              <div><label style={lbl}>Responsable</label><input value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} /></div>
              {editId && <div><label style={lbl}>Estado</label>
                <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>}
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
