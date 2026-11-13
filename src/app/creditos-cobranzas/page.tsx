"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Trash2, X, Search, MessageSquare, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPOS_GESTION = ["Llamado", "Email", "WhatsApp", "Carta documento", "Visita", "Otro"];
const RESULTADOS = ["Sin contacto", "Prometió pago", "Pago parcial", "Niega deuda", "Acordó plan", "Pagó total"];

export default function CreditosCobranzasPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selFactura, setSelFactura] = useState<any | null>(null);
  const [gestiones, setGestiones] = useState<any[]>([]);
  const [showGestionForm, setShowGestionForm] = useState(false);
  const [gestionForm, setGestionForm] = useState({ fecha: new Date().toISOString().split("T")[0], tipo: "Email", resultado: "", notas: "", proxima_accion: "", fecha_proxima: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetch_ = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ estado: "cobro_pendiente", search });
    setFacturas(await (await fetch(`/api/facturas-emitidas?${qs}`)).json());
    setLoading(false);
  };

  const fetchGestiones = async (facturaId: number) => {
    setGestiones(await (await fetch(`/api/gestiones-cobranza?factura_id=${facturaId}`)).json());
  };

  useEffect(() => { fetch_(); }, [search]);

  const seleccionarFactura = (f: any) => {
    setSelFactura(f);
    fetchGestiones(f.id);
  };

  const handleSaveGestion = async () => {
    if (!selFactura) return;
    setSaving(true); setError("");
    const res = await fetch("/api/gestiones-cobranza", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gestionForm, factura_id: selFactura.id }) });
    if (res.ok) { setShowGestionForm(false); fetchGestiones(selFactura.id); setGestionForm({ fecha: new Date().toISOString().split("T")[0], tipo: "Email", resultado: "", notas: "", proxima_accion: "", fecha_proxima: "" }); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDeleteGestion = async (id: number) => {
    if (!confirm("¿Eliminar esta gestión?")) return;
    await fetch(`/api/gestiones-cobranza/${id}`, { method: "DELETE" });
    if (selFactura) fetchGestiones(selFactura.id);
  };

  const hoy = new Date().toISOString().split("T")[0];
  const getDiasVencido = (venc: string) => {
    if (!venc) return null;
    const diff = Math.floor((new Date(hoy).getTime() - new Date(venc).getTime()) / 86400000);
    return diff;
  };

  const totalCxC = facturas.reduce((a, f) => a + f.importe_total, 0);
  const vencido = facturas.filter(f => f.fecha_vencimiento && f.fecha_vencimiento < hoy).reduce((a, f) => a + f.importe_total, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Créditos y Cobranzas</div>
        <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
          <span>CxC total: <strong>{formatCurrency(totalCxC)}</strong></span>
          {vencido > 0 && <span style={{ color: "#993C1D" }}>Vencido: <strong>{formatCurrency(vencido)}</strong></span>}
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Lista facturas */}
        <div style={{ width: "380px", borderRight: "0.5px solid rgba(0,0,0,0.10)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "12px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input placeholder="Buscar cliente o factura..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "28px", fontSize: "12px", width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>Cargando...</div> : facturas.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Sin facturas pendientes de cobro</div>
            ) : facturas.map(f => {
              const dias = getDiasVencido(f.fecha_vencimiento);
              const colorDias = dias === null ? "#6b7280" : dias > 60 ? "#993C1D" : dias > 30 ? "#854F0B" : dias > 0 ? "#b45309" : "#0F6E56";
              const isSel = selFactura?.id === f.id;
              return (
                <div key={f.id} onClick={() => seleccionarFactura(f)} style={{ padding: "12px 16px", cursor: "pointer", background: isSel ? "#e8f0fb" : "transparent", borderLeft: isSel ? "3px solid #185fa5" : "3px solid transparent", borderBottom: "0.5px solid rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.cliente_nombre || f.razon_social}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280" }}>FC {f.numero} · {f.tipo_comprobante}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "8px" }}>
                      <div style={{ fontSize: "13px", fontWeight: "700" }}>{formatCurrency(f.importe_total)}</div>
                      {dias !== null && <div style={{ fontSize: "11px", color: colorDias, fontWeight: "600" }}>{dias > 0 ? `${dias}d vencido` : dias === 0 ? "Vence hoy" : `${-dias}d por vencer`}</div>}
                    </div>
                  </div>
                  {f.fecha_vencimiento && <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>Venc: {formatDate(f.fecha_vencimiento)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel derecho - gestiones */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {!selFactura ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#9ca3af" }}>
              <MessageSquare size={40} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <div style={{ fontSize: "14px" }}>Seleccioná una factura para ver las gestiones</div>
            </div>
          ) : (
            <>
              {/* Cabecera factura seleccionada */}
              <div style={{ background: "white", borderRadius: "12px", padding: "16px 20px", border: "0.5px solid rgba(0,0,0,0.10)", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: "15px", fontWeight: "700" }}>{selFactura.cliente_nombre || selFactura.razon_social}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>FC {selFactura.numero} · {selFactura.tipo_comprobante} · {selFactura.fecha_emision ? formatDate(selFactura.fecha_emision) : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "22px", fontWeight: "800", color: "#993C1D" }}>{formatCurrency(selFactura.importe_total)}</div>
                    {selFactura.fecha_vencimiento && <div style={{ fontSize: "12px", color: "#6b7280" }}>Venc: {formatDate(selFactura.fecha_vencimiento)}</div>}
                  </div>
                </div>
              </div>

              {/* Botón nueva gestión */}
              {isAdmin && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
                  <button onClick={() => { setShowGestionForm(true); setError(""); }} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    <Plus size={14} /> Registrar gestión
                  </button>
                </div>
              )}

              {/* Timeline de gestiones */}
              {gestiones.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af", fontSize: "13px" }}>Sin gestiones registradas</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {gestiones.map(g => (
                    <div key={g.id} style={{ background: "white", borderRadius: "10px", padding: "14px 18px", border: "0.5px solid rgba(0,0,0,0.10)", position: "relative" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span className="badge badge-blue">{g.tipo}</span>
                          {g.resultado && <span className="badge badge-gray">{g.resultado}</span>}
                          <span style={{ fontSize: "12px", color: "#6b7280" }}>{formatDate(g.fecha)}</span>
                          {g.usuario && <span style={{ fontSize: "11px", color: "#9ca3af" }}>{g.usuario}</span>}
                        </div>
                        {isAdmin && <button onClick={() => handleDeleteGestion(g.id)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9ca3af", padding: "2px" }}><Trash2 size={12} /></button>}
                      </div>
                      <div style={{ fontSize: "13px", color: "#374151", marginTop: "8px" }}>{g.notas}</div>
                      {g.proxima_accion && (
                        <div style={{ marginTop: "8px", fontSize: "12px", color: "#185fa5", display: "flex", alignItems: "center", gap: "5px" }}>
                          <ChevronRight size={12} />
                          Próx: {g.proxima_accion}{g.fecha_proxima ? ` (${formatDate(g.fecha_proxima)})` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal nueva gestión */}
      {showGestionForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowGestionForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>Registrar gestión de cobranza</div>
              <button onClick={() => setShowGestionForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Fecha *</label><input type="date" value={gestionForm.fecha} onChange={e => setGestionForm(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div><label style={lbl}>Tipo *</label>
                <select value={gestionForm.tipo} onChange={e => setGestionForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS_GESTION.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Resultado</label>
                <select value={gestionForm.resultado} onChange={e => setGestionForm(f => ({ ...f, resultado: e.target.value }))}>
                  <option value="">— sin resultado —</option>
                  {RESULTADOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Notas *</label>
                <textarea value={gestionForm.notas} onChange={e => setGestionForm(f => ({ ...f, notas: e.target.value }))} rows={3} style={{ width: "100%", padding: "8px 10px", fontSize: "13px", border: "0.5px solid #e5e7eb", borderRadius: "8px", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }} placeholder="Detalles de la gestión..." />
              </div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Próxima acción</label><input value={gestionForm.proxima_accion} onChange={e => setGestionForm(f => ({ ...f, proxima_accion: e.target.value }))} placeholder="Ej: Llamar nuevamente" /></div>
              <div><label style={lbl}>Fecha próxima acción</label><input type="date" value={gestionForm.fecha_proxima} onChange={e => setGestionForm(f => ({ ...f, fecha_proxima: e.target.value }))} /></div>
            </div>
            {error && <div style={{ color: "#993C1D", fontSize: "13px", marginTop: "12px", background: "#f9ece7", padding: "10px", borderRadius: "8px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowGestionForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveGestion} disabled={saving} style={primaryBtn}>{saving ? "Guardando..." : "Guardar gestión"}</button>
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
