"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPOS_SERVICIO = ["debito_automatico", "pago_manual", "impuesto_afip", "alquiler"];
const TIPOS_SERVICIO_LABELS: Record<string, string> = {
  debito_automatico: "Débito automático",
  pago_manual: "Pago manual",
  impuesto_afip: "Impuesto AFIP",
  alquiler: "Alquiler",
};
const TIPOS_DDJJ = ["IVA", "IIBB", "SICORE (Ret. Ganancias)", "Ganancias", "Cargas Sociales", "Bienes Personales", "Plan de pagos", "ART", "Imp. débitos y créditos bancarios", "SIRCREB (IIBB bancario)", "Percepción IIBB bancaria", "IVA bancario (RG 2408)", "Otra"];
const ESTADOS_DDJJ: Record<string, { label: string; cls: string }> = {
  pendiente:  { label: "Pendiente",  cls: "badge-yellow" },
  presentada: { label: "Presentada", cls: "badge-blue" },
  pagada:     { label: "Pagada",     cls: "badge-green" },
};

const emptySrv = { descripcion: "", tipo: "pago_manual", proveedor_id: "", importe_estimado: "", moneda: "ARS", dia_vencimiento: "", activo: true, notas: "" };
const emptyDdjj = { tipo: "IVA", periodo: "", vep: "", monto: "", fecha_pago: "", estado: "pendiente", notas: "" };

export default function ImpuestosServiciosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [tab, setTab] = useState<"servicios" | "ddjj">("ddjj");
  const [ddjjTipo, setDdjjTipo] = useState("");
  const [ddjjAnio, setDdjjAnio] = useState("2025");
  const [servicios, setServicios] = useState<any[]>([]);
  const [ddjjs, setDdjjs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [showSrvForm, setShowSrvForm] = useState(false);
  const [showDdjjForm, setShowDdjjForm] = useState(false);
  const [editSrvId, setEditSrvId] = useState<number | null>(null);
  const [editDdjjId, setEditDdjjId] = useState<number | null>(null);
  const [srvForm, setSrvForm] = useState({ ...emptySrv });
  const [ddjjForm, setDdjjForm] = useState({ ...emptyDdjj });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchServicios = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search, tipo: tipoFilter });
    setServicios(await (await fetch(`/api/servicios-recurrentes?${qs}`)).json());
    setLoading(false);
  };
  const fetchDdjjs = async () => {
    setLoading(true);
    setDdjjs(await (await fetch("/api/declaraciones-juradas")).json());
    setLoading(false);
  };

  useEffect(() => { if (tab === "servicios") fetchServicios(); else fetchDdjjs(); }, [tab, search, tipoFilter]);

  const openEditSrv = (s: any) => {
    setSrvForm({ descripcion: s.descripcion, tipo: s.tipo, proveedor_id: s.proveedor_id ? String(s.proveedor_id) : "", importe_estimado: String(s.importe_estimado || ""), moneda: s.moneda, dia_vencimiento: String(s.dia_vencimiento || ""), activo: s.activo === 1, notas: s.notas || "" });
    setEditSrvId(s.id); setError(""); setShowSrvForm(true);
  };
  const openEditDdjj = (d: any) => {
    setDdjjForm({ tipo: d.tipo, periodo: d.periodo, vep: d.vep || "", monto: String(d.monto || ""), fecha_pago: d.fecha_pago || "", estado: d.estado, notas: d.notas || "" });
    setEditDdjjId(d.id); setError(""); setShowDdjjForm(true);
  };

  const handleSaveSrv = async () => {
    setSaving(true); setError("");
    const url = editSrvId ? `/api/servicios-recurrentes/${editSrvId}` : "/api/servicios-recurrentes";
    const body = { ...srvForm, importe_estimado: parseFloat(srvForm.importe_estimado) || 0, dia_vencimiento: parseInt(srvForm.dia_vencimiento) || null, proveedor_id: srvForm.proveedor_id ? parseInt(srvForm.proveedor_id) : null, activo: srvForm.activo ? 1 : 0 };
    const res = await fetch(url, { method: editSrvId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowSrvForm(false); fetchServicios(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleSaveDdjj = async () => {
    setSaving(true); setError("");
    const url = editDdjjId ? `/api/declaraciones-juradas/${editDdjjId}` : "/api/declaraciones-juradas";
    const body = { ...ddjjForm, monto: parseFloat(ddjjForm.monto) || 0 };
    const res = await fetch(url, { method: editDdjjId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { setShowDdjjForm(false); fetchDdjjs(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDeleteSrv = async (id: number) => {
    if (!confirm("¿Eliminar este servicio?")) return;
    await fetch(`/api/servicios-recurrentes/${id}`, { method: "DELETE" });
    fetchServicios();
  };
  const handleDeleteDdjj = async (id: number) => {
    if (!confirm("¿Eliminar esta DDJJ?")) return;
    await fetch(`/api/declaraciones-juradas/${id}`, { method: "DELETE" });
    fetchDdjjs();
  };

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "0", alignItems: "center" }}>
          {(["servicios", "ddjj"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "6px 18px", fontSize: "13px", fontWeight: tab === t ? "700" : "500", color: tab === t ? "#185fa5" : "#6b7280", background: "transparent", border: "none", borderBottom: tab === t ? "2px solid #185fa5" : "2px solid transparent", cursor: "pointer", fontFamily: "inherit" }}>
              {t === "servicios" ? "Servicios recurrentes" : "Impuestos (DDJJ y pagos)"}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={() => { if (tab === "servicios") { setSrvForm({ ...emptySrv }); setEditSrvId(null); setError(""); setShowSrvForm(true); } else { setDdjjForm({ ...emptyDdjj }); setEditDdjjId(null); setError(""); setShowDdjjForm(true); } }} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            <Plus size={14} /> {tab === "servicios" ? "Nuevo servicio" : "Nueva DDJJ"}
          </button>
        )}
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        {tab === "servicios" && (
          <>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
              </div>
              <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)} style={{ padding: "5px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
                <option value="">Todos los tipos</option>
                {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{TIPOS_SERVICIO_LABELS[t]}</option>)}
              </select>
            </div>
            <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
              {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
                <table className="data-table">
                  <thead><tr><th>Descripción</th><th>Tipo</th><th>Día venc.</th><th>Importe est.</th><th>Estado</th>{isAdmin && <th></th>}</tr></thead>
                  <tbody>
                    {servicios.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin servicios</td></tr>
                    ) : servicios.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: "500" }}>{s.descripcion}{s.proveedor_nombre && <div style={{ fontSize: "11px", color: "#9ca3af" }}>{s.proveedor_nombre}</div>}</td>
                        <td><span className="badge badge-blue">{TIPOS_SERVICIO_LABELS[s.tipo] || s.tipo}</span></td>
                        <td style={{ color: "#6b7280" }}>{s.dia_vencimiento ? `Día ${s.dia_vencimiento}` : "—"}</td>
                        <td style={{ fontWeight: "600" }}>{s.importe_estimado > 0 ? formatCurrency(s.importe_estimado) : "—"}</td>
                        <td><span className={`badge ${s.activo ? "badge-green" : "badge-gray"}`}>{s.activo ? "Activo" : "Inactivo"}</span></td>
                        {isAdmin && <td>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                            <button onClick={() => openEditSrv(s)} style={iconBtn}><Edit2 size={13} /></button>
                            <button onClick={() => handleDeleteSrv(s.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                          </div>
                        </td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === "ddjj" && (() => {
          const lista = ddjjs.filter(d => (!ddjjTipo || d.tipo === ddjjTipo) && (!ddjjAnio || String(d.fecha_pago || d.periodo || "").startsWith(ddjjAnio) || String(d.periodo || "").startsWith(ddjjAnio)));
          const resumen: Record<string, { n: number; pagado: number; pend: number }> = {};
          for (const d of lista) { const r = (resumen[d.tipo] ||= { n: 0, pagado: 0, pend: 0 }); r.n++; if (d.estado === "pagada") r.pagado += d.monto || 0; else if (d.monto > 0) r.pend += d.monto; }
          return (<>
          <div style={{ display: "flex", gap: "10px", marginBottom: "14px", alignItems: "center", flexWrap: "wrap" }}>
            <select value={ddjjAnio} onChange={e => setDdjjAnio(e.target.value)} style={{ padding: "6px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
              <option value="">Todos los años</option><option value="2025">2025</option><option value="2026">2026</option>
            </select>
            <select value={ddjjTipo} onChange={e => setDdjjTipo(e.target.value)} style={{ padding: "6px 10px", fontSize: "13px", borderRadius: "7px", border: "0.5px solid #e5e7eb" }}>
              <option value="">Todos los impuestos</option>
              {TIPOS_DDJJ.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: "12px", color: "#6b7280" }}>Declaraciones juradas presentadas (con su PDF) y pagos de impuestos del extracto bancario.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "10px", marginBottom: "16px" }}>
            {Object.entries(resumen).map(([t, r]) => (
              <div key={t} onClick={() => setDdjjTipo(ddjjTipo === t ? "" : t)} style={{ cursor: "pointer", background: "white", borderRadius: "10px", border: `0.5px solid ${ddjjTipo === t ? "#185fa5" : "rgba(0,0,0,0.10)"}`, padding: "10px 14px" }}>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>{t}</div>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>{formatCurrency(r.pagado)}</div>
                <div style={{ fontSize: "11px", color: r.pend > 0 ? "#993C1D" : "#6b7280" }}>{r.n} registro(s){r.pend > 0 ? ` · sin pago encontrado ${formatCurrency(r.pend)}` : ""}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
            {loading ? <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div> : (
              <table className="data-table">
                <thead><tr><th>Impuesto</th><th>Organismo</th><th>Período</th><th>Monto</th><th>Fecha pago</th><th>Estado</th><th>Detalle</th><th>DDJJ</th>{isAdmin && <th></th>}</tr></thead>
                <tbody>
                  {lista.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin declaraciones</td></tr>
                  ) : lista.map(d => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: "600" }}>{d.tipo}</td>
                      <td style={{ fontSize: "12px", color: "#6b7280" }}>{d.organismo || "—"}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{d.periodo || "—"}</td>
                      <td style={{ fontWeight: "700" }}>{d.monto > 0 ? formatCurrency(d.monto) : d.monto === 0 ? "$ 0,00" : "—"}{d.saldo_a_favor > 0 ? <div style={{ fontSize: "11px", color: "#3B6D11", fontWeight: 400 }}>a favor {formatCurrency(d.saldo_a_favor)}</div> : null}</td>
                      <td style={{ fontSize: "12px" }}>{d.fecha_pago ? formatDate(d.fecha_pago) : "—"}</td>
                      <td><span className={`badge ${ESTADOS_DDJJ[d.estado]?.cls || "badge-gray"}`}>{ESTADOS_DDJJ[d.estado]?.label || d.estado}</span></td>
                      <td style={{ fontSize: "11px", color: String(d.notas || "").includes("a revisar") ? "#993C1D" : "#6b7280", maxWidth: "320px" }}>{d.notas || "—"}</td>
                      <td>{d.archivo_path ? <a href={`/api/archivo?path=${encodeURIComponent(d.archivo_path)}`} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#185fa5" }}>Ver PDF</a> : "—"}</td>
                      {isAdmin && <td>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <button onClick={() => openEditDdjj(d)} style={iconBtn}><Edit2 size={13} /></button>
                          <button onClick={() => handleDeleteDdjj(d.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                        </div>
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </>);
        })()}
      </div>

      {/* Modal servicio recurrente */}
      {showSrvForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowSrvForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "520px", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editSrvId ? "Editar servicio" : "Nuevo servicio recurrente"}</div>
              <button onClick={() => setShowSrvForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Descripción *</label><input value={srvForm.descripcion} onChange={e => setSrvForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Nombre del servicio o impuesto" /></div>
              <div><label style={lbl}>Tipo *</label>
                <select value={srvForm.tipo} onChange={e => setSrvForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{TIPOS_SERVICIO_LABELS[t]}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Día de vencimiento</label><input type="number" value={srvForm.dia_vencimiento} onChange={e => setSrvForm(f => ({ ...f, dia_vencimiento: e.target.value }))} placeholder="Ej: 15" min="1" max="31" /></div>
              <div><label style={lbl}>Importe estimado</label><input type="number" value={srvForm.importe_estimado} onChange={e => setSrvForm(f => ({ ...f, importe_estimado: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Moneda</label>
                <select value={srvForm.moneda} onChange={e => setSrvForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" id="activo" checked={srvForm.activo} onChange={e => setSrvForm(f => ({ ...f, activo: e.target.checked }))} />
                <label htmlFor="activo" style={{ fontSize: "13px", fontWeight: "500" }}>Servicio activo</label>
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Notas</label><input value={srvForm.notas} onChange={e => setSrvForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones..." /></div>
            </div>
            {error && <div style={{ color: "#993C1D", fontSize: "13px", marginTop: "12px", background: "#f9ece7", padding: "10px", borderRadius: "8px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowSrvForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveSrv} disabled={saving} style={primaryBtn}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal DDJJ */}
      {showDdjjForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowDdjjForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editDdjjId ? "Editar DDJJ" : "Nueva declaración jurada"}</div>
              <button onClick={() => setShowDdjjForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Tipo *</label>
                <select value={ddjjForm.tipo} onChange={e => setDdjjForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_DDJJ.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Período *</label><input value={ddjjForm.periodo} onChange={e => setDdjjForm(f => ({ ...f, periodo: e.target.value }))} placeholder="Ej: 2024/11" /></div>
              <div><label style={lbl}>VEP</label><input value={ddjjForm.vep} onChange={e => setDdjjForm(f => ({ ...f, vep: e.target.value }))} placeholder="Nro VEP" /></div>
              <div><label style={lbl}>Monto</label><input type="number" value={ddjjForm.monto} onChange={e => setDdjjForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div><label style={lbl}>Fecha de pago</label><input type="date" value={ddjjForm.fecha_pago} onChange={e => setDdjjForm(f => ({ ...f, fecha_pago: e.target.value }))} /></div>
              <div><label style={lbl}>Estado</label>
                <select value={ddjjForm.estado} onChange={e => setDdjjForm(f => ({ ...f, estado: e.target.value }))}>
                  {Object.entries(ESTADOS_DDJJ).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Notas</label><input value={ddjjForm.notas} onChange={e => setDdjjForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones..." /></div>
            </div>
            {error && <div style={{ color: "#993C1D", fontSize: "13px", marginTop: "12px", background: "#f9ece7", padding: "10px", borderRadius: "8px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowDdjjForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveDdjj} disabled={saving} style={primaryBtn}>{saving ? "Guardando..." : "Guardar"}</button>
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
