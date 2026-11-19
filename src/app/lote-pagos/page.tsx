"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import {
  Plus, Search, X, AlertTriangle, Building2,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, Trash2,
  Loader2,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TABS = [
  { key: "pendientes",  label: "Vigentes" },
  { key: "completados", label: "Ejecutados" },
];

const BADGE_ESTADO: Record<string, { label: string; color: string; bg: string }> = {
  borrador:  { label: "Borrador",  color: "#854F0B", bg: "#fef3e2" },
  aprobado:  { label: "Aprobado",  color: "#185fa5", bg: "#e8f0fa" },
  ejecutado: { label: "Ejecutado", color: "#0F6E56", bg: "#e6f4f0" },
  cancelado: { label: "Rechazado", color: "#6b7280", bg: "#f3f4f6" },
};

export default function LotePagosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const [tab, setTab] = useState("pendientes");
  const [search, setSearch] = useState("");
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  // Modal de nuevo lote — paso a paso
  const [showForm, setShowForm] = useState(false);
  const [paso, setPaso] = useState<1 | 2>(1);
  const [fechaPago, setFechaPago] = useState("");
  const [candidatos, setCandidatos] = useState<any[]>([]);
  const [loadingCand, setLoadingCand] = useState(false);
  const [selItems, setSelItems] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchLotes = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ tab, search });
    setLotes(await (await fetch(`/api/lotes-pagos?${qs}`)).json());
    setLoading(false);
  };

  useEffect(() => { fetchLotes(); }, [tab, search]);

  const openDetail = async (id: number) => {
    setLoadingDetail(true);
    const res = await fetch(`/api/lotes-pagos/${id}`);
    setSelected(await res.json());
    setLoadingDetail(false);
  };

  const cambiarEstado = async (id: number, estado: string) => {
    await fetch(`/api/lotes-pagos/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    fetchLotes();
    openDetail(id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este lote de pagos?")) return;
    await fetch(`/api/lotes-pagos/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    fetchLotes();
  };

  // ── Nuevo lote paso 1 → 2 ──────────────────────────────────────────────────
  const cargarCandidatos = async () => {
    if (!fechaPago) return;
    setLoadingCand(true); setFormError("");
    const res = await fetch(`/api/lotes-pagos/candidatos?fecha_pago=${fechaPago}`);
    if (!res.ok) { setFormError("Error al cargar candidatos"); setLoadingCand(false); return; }
    const data = await res.json();
    setCandidatos(data.facturas || []);
    // Pre-seleccionar todas
    setSelItems(new Set((data.facturas || []).map((f: any) => f.id)));
    setPaso(2);
    setLoadingCand(false);
  };

  const toggleSelItem = (id: number) => {
    setSelItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selAll = () => setSelItems(new Set(candidatos.map(c => c.id)));
  const selNone = () => setSelItems(new Set());

  const totalSel = candidatos
    .filter(c => selItems.has(c.id))
    .reduce((s, c) => s + (Number(c.importe_total) || 0), 0);

  const handleCreate = async () => {
    if (!fechaPago) return;
    setSaving(true); setFormError("");
    const items = candidatos
      .filter(c => selItems.has(c.id))
      .map(c => ({
        factura_id: c.id,
        importe: c.importe_total,
        proveedor: c.proveedor,
        comprobante: `${c.tipo_comprobante || ""} ${c.punto_venta ? String(c.punto_venta).padStart(4,"0") + "-" : ""}${String(c.numero || "").padStart(8,"0")}`.trim(),
        cbu: c.cbu || "",
        cuit: c.cuit_proveedor || "",
        fecha_factura: c.fecha_emision || "",
        descripcion: c.concepto || "",
      }));
    const res = await fetch("/api/lotes-pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha_pago: fechaPago, items }),
    });
    if (res.ok) {
      setShowForm(false); resetForm(); fetchLotes();
    } else {
      const j = await res.json();
      setFormError(j.error || "Error al crear lote");
    }
    setSaving(false);
  };

  const resetForm = () => {
    setPaso(1); setFechaPago(""); setCandidatos([]); setSelItems(new Set()); setFormError("");
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isPrioritario = (l: any) =>
    l.prioritario === 1 || (l.dias_max_vencida != null && Number(l.dias_max_vencida) > 60);

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Lote de Pagos</div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Nuevo lote
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid #e5e7eb", marginBottom: "20px" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelected(null); }} style={{
              background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: "14px", fontWeight: tab === t.key ? "700" : "500",
              color: tab === t.key ? "#111827" : "#6b7280",
              padding: "10px 20px",
              borderBottom: tab === t.key ? "2px solid #111827" : "2px solid transparent",
              marginBottom: "-0.5px",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: "480px", marginBottom: "16px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input placeholder="Buscar por proveedor o monto..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "36px", width: "100%", fontSize: "13px", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "9px 12px 9px 36px" }} />
        </div>

        {/* Tabla */}
        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
          ) : lotes.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center" }}>
              <Building2 size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: "14px", color: "#9ca3af" }}>{search ? "Sin resultados" : `No hay lotes ${tab}`}</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                  <th style={{ width: "32px", padding: "10px 8px 10px 16px" }} />
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Lote</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Fecha pago</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Total</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Estado</th>
                  <th style={{ width: "80px" }} />
                </tr>
              </thead>
              <tbody>
                {lotes.map((l: any) => {
                  const prioritario = isPrioritario(l);
                  const est = BADGE_ESTADO[l.estado] || BADGE_ESTADO.borrador;
                  const isOpen = selected?.id === l.id;
                  const cant = Number(l.cant_items) || 0;

                  return [
                    <tr key={l.id} onClick={() => isOpen ? setSelected(null) : openDetail(l.id)} style={{ borderBottom: "0.5px solid #f3f4f6", cursor: "pointer", background: isOpen ? "#f8fbff" : undefined }}>
                      <td style={{ padding: "14px 8px 14px 16px" }} onClick={e => { e.stopPropagation(); toggleCheck(l.id); }}>
                        <input type="checkbox" checked={checkedIds.has(l.id)} onChange={() => {}} style={{ cursor: "pointer" }} />
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>{l.nombre}</span>
                          {prioritario && <span style={{ display: "flex", alignItems: "center", gap: "3px", background: "#fee2e2", color: "#dc2626", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "12px" }}><AlertTriangle size={9} /> Prioritario</span>}
                        </div>
                        <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                          Creado {formatDate(l.fecha)} · {cant} pago{cant !== 1 ? "s" : ""}
                        </div>
                      </td>
                      <td style={{ padding: "14px 12px", fontSize: "13px", color: "#374151" }}>
                        {l.fecha_pago ? formatDate(l.fecha_pago) : "—"}
                      </td>
                      <td style={{ padding: "14px 12px", textAlign: "right", fontSize: "14px", fontWeight: "700" }}>
                        {formatCurrency(l.total || 0)}
                      </td>
                      <td style={{ padding: "14px 12px" }}>
                        <span style={{ background: est.bg, color: est.color, fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "12px" }}>{est.label}</span>
                      </td>
                      <td style={{ padding: "14px 12px", textAlign: "right" }}>
                        {isOpen ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
                      </td>
                    </tr>,

                    isOpen && (
                      <tr key={`det-${l.id}`}>
                        <td colSpan={6} style={{ padding: 0, background: "#f8fbff", borderBottom: "0.5px solid #e8f0fa" }}>
                          {loadingDetail ? (
                            <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>Cargando...</div>
                          ) : (
                            <div style={{ padding: "16px 24px 20px 56px" }}>
                              {/* Actions */}
                              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                                {isAdmin && selected?.estado === "borrador" && (
                                  <button className="btn-primary" onClick={e => { e.stopPropagation(); cambiarEstado(selected.id, "aprobado"); }} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}>
                                    <CheckCircle2 size={13} /> Aprobar
                                  </button>
                                )}
                                {isAdmin && selected?.estado === "aprobado" && (
                                  <button className="btn-primary" onClick={e => { e.stopPropagation(); cambiarEstado(selected.id, "ejecutado"); }} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}>
                                    <CheckCircle2 size={13} /> Marcar ejecutado → genera OPs
                                  </button>
                                )}
                                {isAdmin && selected?.estado === "borrador" && (
                                  <button onClick={e => { e.stopPropagation(); cambiarEstado(selected.id, "cancelado"); }} style={{ ...btnSec, color: "#993C1D" }}>
                                    <XCircle size={13} /> Rechazar
                                  </button>
                                )}
                                {isAdmin && ["borrador", "cancelado"].includes(selected?.estado) && (
                                  <button onClick={e => { e.stopPropagation(); handleDelete(selected.id); }} style={{ ...btnSec, color: "#6b7280" }}>
                                    <Trash2 size={12} /> Eliminar
                                  </button>
                                )}
                              </div>

                              {/* Items table */}
                              {(!selected?.items || selected.items.length === 0) ? (
                                <div style={{ color: "#9ca3af", fontSize: "13px" }}>Este lote no tiene ítems.</div>
                              ) : (
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                  <thead>
                                    <tr style={{ background: "#f3f4f6", borderBottom: "0.5px solid #e5e7eb" }}>
                                      <th style={thStyle}>Proveedor</th>
                                      <th style={thStyle}>Nº Factura</th>
                                      <th style={thStyle}>Descripción</th>
                                      <th style={{ ...thStyle, textAlign: "right" }}>Monto</th>
                                      <th style={{ ...thStyle, textAlign: "center" }}>Nº OP</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selected.items.map((item: any, idx: number) => (
                                      <tr key={item.id} style={{ borderBottom: "0.5px solid #f3f4f6", background: idx % 2 === 1 ? "#fafbfc" : "white" }}>
                                        <td style={{ padding: "7px 10px", fontWeight: 500 }}>
                                          {item.proveedor_nombre || item.proveedor || "—"}
                                        </td>
                                        <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "12px" }}>
                                          {item.tipo_comprobante ? `${item.tipo_comprobante} ${item.numero}` : item.comprobante || "—"}
                                        </td>
                                        <td style={{ padding: "7px 10px", color: "#6b7280", fontSize: "12px" }}>
                                          {item.descripcion || "—"}
                                        </td>
                                        <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: "700" }}>
                                          {formatCurrency(item.importe)}
                                        </td>
                                        <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                          {item.op_numero
                                            ? <span style={{ fontSize: "12px", color: "#0F6E56", fontWeight: 600 }}>{item.op_numero}</span>
                                            : <span style={{ color: "#d1d5db" }}>—</span>
                                          }
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr style={{ borderTop: "1.5px solid #e5e7eb" }}>
                                      <td colSpan={3} style={{ padding: "8px 10px", fontWeight: 600, fontSize: "13px" }}>Total</td>
                                      <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, fontSize: "14px" }}>
                                        {formatCurrency(selected.items.reduce((s: number, i: any) => s + (Number(i.importe) || 0), 0))}
                                      </td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                </table>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {checkedIds.size > 0 && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#111827", borderRadius: "12px", padding: "12px 20px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 100 }}>
          <span style={{ color: "white", fontSize: "13px", fontWeight: "600" }}>{checkedIds.size} seleccionado{checkedIds.size !== 1 ? "s" : ""}</span>
          <button onClick={() => setCheckedIds(new Set())} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "7px", padding: "6px 12px", color: "white", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>Deseleccionar</button>
        </div>
      )}

      {/* ── Modal nuevo lote ────────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "60px" }}>
          <div style={{ background: "white", borderRadius: "14px", width: paso === 1 ? "380px" : "740px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.18)" }}>
            {/* Modal header */}
            <div style={{ padding: "20px 24px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.5px solid #e5e7eb" }}>
              <div>
                <div style={{ fontSize: "15px", fontWeight: "700" }}>Nuevo lote de pagos</div>
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                  {paso === 1 ? "Paso 1 de 2: Fecha de pago" : `Paso 2 de 2: ${candidatos.length} facturas encontradas`}
                </div>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
            </div>

            {/* Modal body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              {paso === 1 ? (
                <div>
                  <div style={{ marginBottom: "16px" }}>
                    <label style={lblStyle}>Fecha de pago</label>
                    <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)} style={{ width: "100%" }} />
                  </div>
                  <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 16px" }}>
                    Se cargarán todas las facturas con vencimiento hasta esa fecha que aún no fueron pagadas.
                  </p>
                  {formError && <div style={errStyle}>{formError}</div>}
                </div>
              ) : (
                <div>
                  {/* Acciones selección */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <div style={{ fontSize: "13px", color: "#374151" }}>
                      <strong>{selItems.size}</strong> de {candidatos.length} seleccionadas
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={selAll} style={btnLinkStyle}>Seleccionar todo</button>
                      <button onClick={selNone} style={btnLinkStyle}>Ninguna</button>
                    </div>
                  </div>

                  {candidatos.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
                      No hay facturas pendientes con vencimiento hasta el {formatDate(fechaPago)}.
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#f3f4f6" }}>
                          <th style={{ width: "32px", padding: "6px 8px" }}></th>
                          <th style={{ ...thStyle, fontSize: "11px" }}>Proveedor</th>
                          <th style={{ ...thStyle, fontSize: "11px" }}>Comprobante</th>
                          <th style={{ ...thStyle, fontSize: "11px" }}>Vto</th>
                          <th style={{ ...thStyle, textAlign: "right", fontSize: "11px" }}>Importe</th>
                          <th style={{ ...thStyle, fontSize: "11px" }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidatos.map((c, idx) => (
                          <tr key={c.id} style={{ borderBottom: "0.5px solid #f3f4f6", background: idx % 2 === 1 ? "#fafbfc" : "white" }} onClick={() => toggleSelItem(c.id)}>
                            <td style={{ padding: "6px 8px" }}>
                              <input type="checkbox" checked={selItems.has(c.id)} onChange={() => {}} style={{ cursor: "pointer" }} />
                            </td>
                            <td style={{ padding: "5px 8px", fontWeight: 500, maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.proveedor}
                            </td>
                            <td style={{ padding: "5px 8px", fontFamily: "monospace", fontSize: "11px" }}>
                              {c.tipo_comprobante} {c.numero ? String(c.numero).padStart(8,"0") : ""}
                            </td>
                            <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>
                              <span style={{ color: c.vencida ? "#993C1D" : "#374151" }}>
                                {formatDate(c.fecha_vencimiento)}
                                {c.vencida ? " ⚠" : ""}
                              </span>
                            </td>
                            <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>
                              {formatCurrency(c.importe_total)}
                            </td>
                            <td style={{ padding: "5px 8px" }}>
                              {c.vencida
                                ? <span style={{ fontSize: "10px", fontWeight: 600, color: "#993C1D", background: "#f9ece7", padding: "2px 6px", borderRadius: "8px" }}>Vencida</span>
                                : <span style={{ fontSize: "10px", fontWeight: 600, color: "#854F0B", background: "#fef3e2", padding: "2px 6px", borderRadius: "8px" }}>Por vencer</span>
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {formError && <div style={{ ...errStyle, marginTop: "12px" }}>{formError}</div>}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: "16px 24px", borderTop: "0.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              {paso === 2 ? (
                <>
                  <div style={{ fontSize: "14px", fontWeight: "700" }}>
                    Total seleccionado: <span style={{ color: "#185fa5" }}>{formatCurrency(totalSel)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setPaso(1)} style={btnCancelStyle}>← Volver</button>
                    <button onClick={handleCreate} disabled={saving || selItems.size === 0} style={btnPrimaryStyle}>
                      {saving ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Creando...</> : `Crear lote (${selItems.size} items)`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => { setShowForm(false); resetForm(); }} style={btnCancelStyle}>Cancelar</button>
                    <button onClick={cargarCandidatos} disabled={!fechaPago || loadingCand} style={btnPrimaryStyle}>
                      {loadingCand ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Cargando...</> : "Ver facturas pendientes →"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const thStyle: React.CSSProperties = { textAlign: "left", padding: "7px 10px", fontWeight: 600, color: "#6b7280", fontSize: "12px" };
const btnSec: React.CSSProperties = { display: "flex", alignItems: "center", gap: "5px", background: "none", border: "0.5px solid #e5e7eb", borderRadius: "7px", padding: "5px 10px", cursor: "pointer", fontSize: "12px", fontFamily: "inherit" };
const lblStyle: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "5px" };
const errStyle: React.CSSProperties = { background: "#f9ece7", color: "#993C1D", padding: "10px 14px", borderRadius: "8px", fontSize: "13px" };
const btnLinkStyle: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#185fa5", fontFamily: "inherit", textDecoration: "underline", padding: "0" };
const btnCancelStyle: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const btnPrimaryStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
