"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Search, X, AlertTriangle, Building2, ChevronDown, ChevronRight, CheckCircle2, XCircle, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TABS = [
  { key: "pendientes",   label: "Vigentes" },
  { key: "completados",  label: "Ejecutados" },
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: "", fecha: "" });
  const [saving, setSaving] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

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
    if (selected?.id === id) openDetail(id);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este lote de pagos?")) return;
    await fetch(`/api/lotes-pagos/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    fetchLotes();
  };

  const handleCreate = async () => {
    if (!form.fecha) return;
    setSaving(true);
    const [yy, mm, dd] = form.fecha.split("-");
    const res = await fetch("/api/lotes-pagos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // El lote se llama por su fecha de pago; "fecha" es el día en que se crea
      body: JSON.stringify({ nombre: `Lote ${dd}.${mm}.${yy}`, fecha: new Date().toISOString().slice(0, 10), fecha_pago: form.fecha, items: [] }),
    });
    if (res.ok) { setShowForm(false); setForm({ nombre: "", fecha: "" }); fetchLotes(); }
    setSaving(false);
  };

  const toggleCheck = (id: number) => {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isPrioritario = (l: any) =>
    l.prioritario === 1 || (l.dias_max_vencida != null && Number(l.dias_max_vencida) > 60);

  const getOperacion = (l: any) => {
    const cant = Number(l.cant_items) || 0;
    if (cant === 0) return { titulo: l.nombre, subtitulo: "Sin ítems" };
    return { titulo: l.nombre, subtitulo: `${cant} pago${cant !== 1 ? "s" : ""}` };
  };

  const counts = { pendientes: 0, completados: 0, rechazados: 0 };

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Solicitudes y operaciones</div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Nuevo lote
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
        <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 20px" }}>
          Gestioná y da seguimiento a los lotes de pagos realizados por usuarios administradores.
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0", borderBottom: "0.5px solid #e5e7eb", marginBottom: "20px" }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelected(null); }}
              style={{
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: "14px", fontWeight: tab === t.key ? "700" : "500",
                color: tab === t.key ? "#111827" : "#6b7280",
                padding: "10px 20px",
                borderBottom: tab === t.key ? "2px solid #111827" : "2px solid transparent",
                marginBottom: "-0.5px",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: "480px", marginBottom: "16px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            placeholder="Buscar por proveedor, solicitante o monto"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: "36px", width: "100%", fontSize: "13px", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "9px 12px 9px 36px" }}
          />
        </div>

        {/* Table */}
        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
          ) : lotes.length === 0 ? (
            <div style={{ padding: "60px", textAlign: "center" }}>
              <Building2 size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: "14px", color: "#9ca3af" }}>
                {search ? "Sin resultados para esa búsqueda" : `No hay lotes ${tab}`}
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                  <th style={{ width: "32px", padding: "10px 8px 10px 16px" }} />
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Operación</th>
                  <th style={{ textAlign: "right", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Monto</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Solicitante</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>Estado</th>
                  <th style={{ width: "80px" }} />
                </tr>
              </thead>
              <tbody>
                {lotes.map((l: any) => {
                  const { titulo, subtitulo } = getOperacion(l);
                  const prioritario = isPrioritario(l);
                  const est = BADGE_ESTADO[l.estado] || BADGE_ESTADO.borrador;
                  const isOpen = selected?.id === l.id;

                  return (
                    <>
                      <tr
                        key={l.id}
                        onClick={() => isOpen ? setSelected(null) : openDetail(l.id)}
                        style={{
                          borderBottom: "0.5px solid #f3f4f6",
                          cursor: "pointer",
                          background: isOpen ? "#f8fbff" : "transparent",
                        }}
                      >
                        <td style={{ padding: "14px 8px 14px 16px" }} onClick={e => { e.stopPropagation(); toggleCheck(l.id); }}>
                          <input
                            type="checkbox"
                            checked={checkedIds.has(l.id)}
                            onChange={() => {}}
                            style={{ cursor: "pointer" }}
                          />
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span style={{ fontSize: "14px", fontWeight: "600", color: "#111827" }}>{titulo}</span>
                                {prioritario && (
                                  <span style={{ display: "flex", alignItems: "center", gap: "3px", background: "#fee2e2", color: "#dc2626", fontSize: "10px", fontWeight: "700", padding: "2px 7px", borderRadius: "12px" }}>
                                    <AlertTriangle size={9} /> Prioritario
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                                {subtitulo} · {formatDate(l.fecha)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 12px", textAlign: "right" }}>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                            ARS {formatCurrency(l.total || 0)}
                          </div>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{ fontSize: "13px", color: "#374151" }}>{l.creado_por || "—"}</span>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <span style={{ background: est.bg, color: est.color, fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "12px" }}>
                            {est.label}
                          </span>
                        </td>
                        <td style={{ padding: "14px 12px" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px" }}>
                            {isOpen ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail */}
                      {isOpen && (
                        <tr key={`det-${l.id}`}>
                          <td colSpan={6} style={{ padding: "0", background: "#f8fbff", borderBottom: "0.5px solid #e8f0fa" }}>
                            {loadingDetail ? (
                              <div style={{ padding: "24px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>Cargando...</div>
                            ) : (
                              <div style={{ padding: "16px 24px 20px 56px" }}>
                                {/* Action buttons */}
                                <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
                                  {isAdmin && selected?.estado === "borrador" && (
                                    <button
                                      className="btn-primary"
                                      onClick={e => { e.stopPropagation(); cambiarEstado(selected.id, "aprobado"); }}
                                      style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}
                                    >
                                      <CheckCircle2 size={13} /> Aprobar
                                    </button>
                                  )}
                                  {isAdmin && selected?.estado === "aprobado" && (
                                    <button
                                      className="btn-primary"
                                      onClick={e => { e.stopPropagation(); cambiarEstado(selected.id, "ejecutado"); }}
                                      style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px" }}
                                    >
                                      <CheckCircle2 size={13} /> Marcar ejecutado
                                    </button>
                                  )}
                                  {isAdmin && ["borrador"].includes(selected?.estado) && (
                                    <button
                                      onClick={e => { e.stopPropagation(); cambiarEstado(selected.id, "cancelado"); }}
                                      style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "0.5px solid #e5e7eb", borderRadius: "7px", padding: "5px 10px", cursor: "pointer", color: "#993C1D", fontSize: "12px", fontFamily: "inherit" }}
                                    >
                                      <XCircle size={13} /> Rechazar
                                    </button>
                                  )}
                                  {isAdmin && ["borrador", "cancelado"].includes(selected?.estado) && (
                                    <button
                                      onClick={e => { e.stopPropagation(); handleDelete(selected.id); }}
                                      style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "0.5px solid #e5e7eb", borderRadius: "7px", padding: "5px 10px", cursor: "pointer", color: "#6b7280", fontSize: "12px", fontFamily: "inherit" }}
                                    >
                                      <Trash2 size={12} /> Eliminar
                                    </button>
                                  )}
                                </div>

                                {/* Items table */}
                                {(!selected?.items || selected.items.length === 0) ? (
                                  <div style={{ color: "#9ca3af", fontSize: "13px" }}>Este lote no tiene ítems todavía.</div>
                                ) : (
                                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                                    <thead>
                                      <tr style={{ borderBottom: "0.5px solid #e5e7eb" }}>
                                        <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Proveedor</th>
                                        <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Comprobante</th>
                                        <th style={{ textAlign: "left", padding: "6px 10px", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Descripción</th>
                                        <th style={{ textAlign: "right", padding: "6px 10px", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Importe</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selected.items.map((item: any) => (
                                        <tr key={item.id} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                                          <td style={{ padding: "7px 10px" }}>{item.proveedor || "—"}</td>
                                          <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "12px" }}>{item.tipo_comprobante ? `${item.tipo_comprobante} ${item.numero}` : "—"}</td>
                                          <td style={{ padding: "7px 10px", color: "#6b7280" }}>{item.descripcion || "—"}</td>
                                          <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: "700" }}>{formatCurrency(item.importe)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Selection action bar */}
        {checkedIds.size > 0 && (
          <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#111827", borderRadius: "12px", padding: "12px 20px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)", zIndex: 100 }}>
            <span style={{ color: "white", fontSize: "13px", fontWeight: "600" }}>{checkedIds.size} seleccionado{checkedIds.size !== 1 ? "s" : ""}</span>
            <button
              onClick={() => setCheckedIds(new Set())}
              style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "7px", padding: "6px 12px", color: "white", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}
            >
              Deseleccionar
            </button>
          </div>
        )}
      </div>

      {/* Modal nuevo lote */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "14px", padding: "28px", width: "380px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "600" }}>Nuevo lote de pagos</div>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label className="form-label">Fecha de pago</label>
                <input type="date" className="form-input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreate} disabled={saving || !form.fecha}>{saving ? "Creando..." : "Crear lote"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
