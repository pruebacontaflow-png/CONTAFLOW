"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, AlertTriangle, Eye, ChevronRight,
  RefreshCw, CheckSquare, FileText, X,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

type TabKey = "compras" | "ventas";
type EstadoBandeja = "pendiente_revision" | "requiere_revision";

const ESTADO_INFO: Record<EstadoBandeja, { label: string; color: string; bg: string }> = {
  pendiente_revision: { label: "Pendiente revisión", color: "#185fa5", bg: "#e8f0fa" },
  requiere_revision:  { label: "Requiere revisión", color: "#854F0B", bg: "#fef3e2" },
};

interface Comprobante {
  id: number;
  tipo_comprobante: string;
  punto_venta: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  importe_neto: number;
  neto_gravado: number;
  neto_no_gravado: number;
  exento: number;
  tipo_iva: string;
  importe_iva: number;
  percepcion_iva: number;
  percepcion_iibb: number;
  percepcion_otras: number;
  importe_total: number;
  moneda: string;
  tipo_cambio: number;
  concepto: string;
  estado: EstadoBandeja;
  motivo_revision: string;
  origen: string;
  confianza_extraccion: number;
  cae: string;
  vencimiento_cae: string;
  pdf_path: string;
  drive_url: string;
  cargada_por_proveedor: number;
  // joined
  proveedor_nombre?: string;
  proveedor_cuit?: string;
  cliente_nombre?: string;
  cliente_cuit?: string;
}

interface EditForm {
  proveedor_id: string;
  cliente_id: string;
  tipo_comprobante: string;
  punto_venta: string;
  numero: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  neto_gravado: string;
  neto_no_gravado: string;
  exento: string;
  importe_iva: string;
  percepcion_iva: string;
  percepcion_iibb: string;
  percepcion_otras: string;
  importe_total: string;
  moneda: string;
  tipo_cambio: string;
  cae: string;
  vencimiento_cae: string;
  concepto: string;
  estado: string;
}

export default function BandejaPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  useEffect(() => {
    if (session && role !== "admin") router.push("/dashboard");
  }, [session, role, router]);

  const [tab, setTab] = useState<TabKey>("compras");
  const [compras, setCompras] = useState<Comprobante[]>([]);
  const [ventas, setVentas] = useState<Comprobante[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Comprobante | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rechazandoId, setRechazandoId] = useState<number | null>(null);
  const [rechazandoMotivo, setRechazandoMotivo] = useState("");

  const items = tab === "compras" ? compras : ventas;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    const [rC, rV, rP, rCl] = await Promise.all([
      fetch("/api/bandeja?tipo=compra").then(r => r.json()),
      fetch("/api/bandeja?tipo=venta").then(r => r.json()),
      fetch("/api/proveedores").then(r => r.json()),
      fetch("/api/clientes").then(r => r.json()),
    ]);
    setCompras(Array.isArray(rC) ? rC : []);
    setVentas(Array.isArray(rV) ? rV : []);
    setProveedores(Array.isArray(rP) ? rP : []);
    setClientes(Array.isArray(rCl) ? rCl : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openDetalle = (c: Comprobante) => {
    setSelected(c);
    setPdfUrl(c.pdf_path ? `/api/pdf/${c.pdf_path.replace(/^facturas-pdf\//, "").split("/").map(encodeURIComponent).join("/")}` : null);
    setEditForm({
      proveedor_id: "",
      cliente_id: "",
      tipo_comprobante: c.tipo_comprobante,
      punto_venta: c.punto_venta,
      numero: c.numero,
      fecha_emision: c.fecha_emision,
      fecha_vencimiento: c.fecha_vencimiento,
      neto_gravado: String(c.neto_gravado || c.importe_neto),
      neto_no_gravado: String(c.neto_no_gravado),
      exento: String(c.exento),
      importe_iva: String(c.importe_iva),
      percepcion_iva: String(c.percepcion_iva),
      percepcion_iibb: String(c.percepcion_iibb),
      percepcion_otras: String(c.percepcion_otras),
      importe_total: String(c.importe_total),
      moneda: c.moneda || "ARS",
      tipo_cambio: String(c.tipo_cambio || 1),
      cae: c.cae || "",
      vencimiento_cae: c.vencimiento_cae || "",
      concepto: c.concepto,
      estado: "pendiente_pago",
    });
  };

  const handleAprobar = async (ids: number[], nuevoEstado = "pendiente_pago", formData?: EditForm) => {
    setSaving(true);
    for (const id of ids) {
      const body: any = { accion: "aprobar", nuevo_estado: nuevoEstado };
      if (formData) Object.assign(body, { form: formData });
      await fetch(`/api/bandeja/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    setSelected(null);
    setSelectedIds(new Set());
    fetchData();
  };

  const handleRechazar = async (id: number, motivo: string) => {
    setSaving(true);
    await fetch(`/api/bandeja/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "rechazar", motivo }),
    });
    setSaving(false);
    setRechazandoId(null);
    setRechazandoMotivo("");
    setSelected(null);
    fetchData();
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pendientes = items.filter(i => i.estado === "pendiente_revision" && !i.motivo_revision);

  return (
    <AppLayout>
      <div style={{
        background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)",
        padding: "0 28px", height: "56px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ fontSize: "16px", fontWeight: "600", color: "#1a1a2e" }}>Bandeja de revisión</div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {selectedIds.size > 0 && (
            <button
              onClick={() => handleAprobar(Array.from(selectedIds))}
              disabled={saving}
              style={primaryBtn}
            >
              <CheckSquare size={15} />
              Aprobar seleccionados ({selectedIds.size})
            </button>
          )}
          <button onClick={fetchData} style={iconBtn} title="Actualizar">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e5e7eb", paddingBottom: "0" }}>
          {(["compras", "ventas"] as TabKey[]).map(t => {
            const count = (t === "compras" ? compras : ventas).length;
            return (
              <button key={t} onClick={() => { setTab(t); setSelected(null); setSelectedIds(new Set()); }}
                style={{
                  padding: "8px 16px", fontSize: "13px", fontWeight: tab === t ? "600" : "400",
                  color: tab === t ? "#185fa5" : "#6b7280",
                  background: "transparent", border: "none",
                  borderBottom: tab === t ? "2px solid #185fa5" : "2px solid transparent",
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "6px",
                  marginBottom: "-1px",
                }}
              >
                {t === "compras" ? "Compras" : "Ventas"}
                {count > 0 && (
                  <span style={{ background: "#e8f0fa", color: "#185fa5", borderRadius: "10px", padding: "1px 7px", fontSize: "11px", fontWeight: "700" }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#6b7280" }}>Cargando bandeja...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "#9ca3af" }}>
            <CheckCircle2 size={36} style={{ margin: "0 auto 12px", display: "block", color: "#0F6E56" }} />
            Bandeja vacía — no hay comprobantes pendientes de revisión
          </div>
        ) : (
          <div style={{ display: "flex", gap: "16px", flex: 1, minHeight: 0 }}>
            {/* Lista */}
            <div style={{ width: selected ? "400px" : "100%", minWidth: "320px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
              {/* Aprobación masiva rápida */}
              {pendientes.length > 1 && !selected && (
                <div style={{ background: "#e8f0fa", border: "0.5px solid #c3d9f4", borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#185fa5" }}>
                    {pendientes.length} comprobantes sin observaciones
                  </span>
                  <button
                    onClick={() => handleAprobar(pendientes.map(p => p.id))}
                    disabled={saving}
                    style={{ ...primaryBtn, padding: "6px 12px", fontSize: "12px" }}
                  >
                    <CheckSquare size={13} /> Aprobar todos
                  </button>
                </div>
              )}
              {items.map(c => {
                const info = ESTADO_INFO[c.estado as EstadoBandeja] || ESTADO_INFO.pendiente_revision;
                const isSelected = c.id === selected?.id;
                return (
                  <div key={c.id}
                    style={{
                      background: isSelected ? "#f0f7ff" : "white",
                      border: isSelected ? "1px solid #c3d9f4" : "0.5px solid rgba(0,0,0,0.10)",
                      borderRadius: "10px", padding: "14px 16px",
                      cursor: "pointer", transition: "all 0.1s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <input type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={e => { e.stopPropagation(); toggleSelect(c.id); }}
                        onClick={e => e.stopPropagation()}
                        style={{ marginTop: "3px", flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }} onClick={() => openDetalle(c)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700" }}>
                              {c.tipo_comprobante}-{c.numero}
                            </span>
                            <span style={{ marginLeft: "8px", fontSize: "11px", background: "#f0f2f5", color: "#6b7280", padding: "1px 6px", borderRadius: "8px" }}>
                              {c.origen}
                            </span>
                          </div>
                          <span style={{ fontSize: "14px", fontWeight: "700", color: "#993C1D" }}>
                            {formatCurrency(c.importe_total)}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#374151", marginTop: "4px" }}>
                          {tab === "compras" ? c.proveedor_nombre : c.cliente_nombre}
                          <span style={{ color: "#9ca3af", marginLeft: "6px" }}>
                            {tab === "compras" ? c.proveedor_cuit : c.cliente_cuit}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", color: "#6b7280" }}>{formatDate(c.fecha_emision)}</span>
                          <span style={{ background: info.bg, color: info.color, fontSize: "10px", fontWeight: "600", padding: "2px 7px", borderRadius: "8px" }}>
                            {info.label}
                          </span>
                          {c.confianza_extraccion < 1 && (
                            <span style={{ fontSize: "10px", color: "#854F0B", background: "#fef3e2", padding: "2px 6px", borderRadius: "8px" }}>
                              Conf. {Math.round(c.confianza_extraccion * 100)}%
                            </span>
                          )}
                          {c.motivo_revision && (
                            <span style={{ fontSize: "10px", color: "#993C1D", background: "#f9ece7", padding: "2px 6px", borderRadius: "8px" }}>
                              {c.motivo_revision.length > 50 ? c.motivo_revision.slice(0, 50) + "…" : c.motivo_revision}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => openDetalle(c)} style={{ ...iconBtn, flexShrink: 0 }}>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Panel detalle */}
            {selected && editForm && (
              <div style={{
                flex: 1, background: "white", border: "0.5px solid rgba(0,0,0,0.10)",
                borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden",
              }}>
                {/* Cabecera */}
                <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "14px", fontWeight: "700" }}>
                    {selected.tipo_comprobante}-{selected.numero}
                    <span style={{ marginLeft: "10px", fontSize: "12px", fontWeight: "400", color: "#6b7280" }}>
                      {tab === "compras" ? selected.proveedor_nombre : selected.cliente_nombre}
                    </span>
                  </div>
                  <button onClick={() => setSelected(null)} style={iconBtn}><X size={16} /></button>
                </div>

                <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                  {/* PDF */}
                  <div style={{ flex: 1, background: "#f7f8fa", borderRight: "0.5px solid #e5e7eb", display: "flex", flexDirection: "column" }}>
                    {pdfUrl ? (
                      <iframe src={pdfUrl} style={{ flex: 1, border: "none" }} title="PDF" />
                    ) : selected.drive_url ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                        <FileText size={40} style={{ color: "#9ca3af" }} />
                        <div style={{ fontSize: "12px", color: "#6b7280", textAlign: "center" }}>PDF en Google Drive</div>
                        <a href={selected.drive_url} target="_blank" rel="noreferrer"
                          style={{ ...primaryBtn, textDecoration: "none", padding: "6px 14px", fontSize: "12px" }}>
                          Ver en Drive
                        </a>
                      </div>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "13px" }}>
                        Sin PDF adjunto
                      </div>
                    )}
                  </div>

                  {/* Formulario editable */}
                  <div style={{ width: "340px", overflowY: "auto", padding: "16px" }}>
                    {selected.motivo_revision && (
                      <div style={{ background: "#fef3e2", border: "0.5px solid #fde68a", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px", fontSize: "12px", color: "#854F0B" }}>
                        <AlertTriangle size={12} style={{ display: "inline", marginRight: "5px" }} />
                        {selected.motivo_revision}
                      </div>
                    )}

                    <div style={{ display: "grid", gap: "10px" }}>
                      {tab === "compras" && (
                        <Field label="Proveedor">
                          <select value={editForm.proveedor_id}
                            onChange={e => setEditForm(f => f ? { ...f, proveedor_id: e.target.value } : f)}
                            style={{ fontSize: "12px" }}>
                            <option value="">— Confirmar proveedor —</option>
                            {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} ({p.cuit})</option>)}
                          </select>
                        </Field>
                      )}
                      {tab === "ventas" && (
                        <Field label="Cliente">
                          <select value={editForm.cliente_id}
                            onChange={e => setEditForm(f => f ? { ...f, cliente_id: e.target.value } : f)}
                            style={{ fontSize: "12px" }}>
                            <option value="">— Confirmar cliente —</option>
                            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social} ({c.cuit})</option>)}
                          </select>
                        </Field>
                      )}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <Field label="Tipo">
                          <input value={editForm.tipo_comprobante}
                            onChange={e => setEditForm(f => f ? { ...f, tipo_comprobante: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Número">
                          <input value={editForm.numero}
                            onChange={e => setEditForm(f => f ? { ...f, numero: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Fecha emisión">
                          <input type="date" value={editForm.fecha_emision}
                            onChange={e => setEditForm(f => f ? { ...f, fecha_emision: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Vencimiento">
                          <input type="date" value={editForm.fecha_vencimiento}
                            onChange={e => setEditForm(f => f ? { ...f, fecha_vencimiento: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Neto gravado">
                          <input type="number" value={editForm.neto_gravado}
                            onChange={e => setEditForm(f => f ? { ...f, neto_gravado: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="IVA">
                          <input type="number" value={editForm.importe_iva}
                            onChange={e => setEditForm(f => f ? { ...f, importe_iva: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Neto no gravado">
                          <input type="number" value={editForm.neto_no_gravado}
                            onChange={e => setEditForm(f => f ? { ...f, neto_no_gravado: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Exento">
                          <input type="number" value={editForm.exento}
                            onChange={e => setEditForm(f => f ? { ...f, exento: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Percep. IVA">
                          <input type="number" value={editForm.percepcion_iva}
                            onChange={e => setEditForm(f => f ? { ...f, percepcion_iva: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Percep. IIBB">
                          <input type="number" value={editForm.percepcion_iibb}
                            onChange={e => setEditForm(f => f ? { ...f, percepcion_iibb: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="CAE">
                          <input value={editForm.cae}
                            onChange={e => setEditForm(f => f ? { ...f, cae: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                        <Field label="Vto. CAE">
                          <input type="date" value={editForm.vencimiento_cae}
                            onChange={e => setEditForm(f => f ? { ...f, vencimiento_cae: e.target.value } : f)}
                            style={{ fontSize: "12px" }} />
                        </Field>
                      </div>
                      <Field label="Total">
                        <input type="number" value={editForm.importe_total}
                          onChange={e => setEditForm(f => f ? { ...f, importe_total: e.target.value } : f)}
                          style={{ fontSize: "13px", fontWeight: "700", color: "#185fa5" }} />
                      </Field>
                      <Field label="Concepto">
                        <input value={editForm.concepto}
                          onChange={e => setEditForm(f => f ? { ...f, concepto: e.target.value } : f)}
                          style={{ fontSize: "12px" }} />
                      </Field>
                    </div>

                    {/* Acciones */}
                    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <button
                        onClick={() => handleAprobar([selected.id], "pendiente_pago", editForm ?? undefined)}
                        disabled={saving}
                        style={{ ...primaryBtn, background: "#0F6E56", justifyContent: "center" }}
                      >
                        <CheckCircle2 size={15} />
                        {saving ? "Procesando..." : "Aprobar y guardar"}
                      </button>
                      <button
                        onClick={() => { setRechazandoId(selected.id); setRechazandoMotivo(""); }}
                        style={{ ...primaryBtn, background: "#993C1D", justifyContent: "center" }}
                      >
                        <XCircle size={15} />
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal rechazo */}
      {rechazandoId !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setRechazandoId(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "440px" }}>
            <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "16px" }}>Rechazar comprobante</div>
            <Field label="Motivo del rechazo *">
              <textarea
                value={rechazandoMotivo}
                onChange={e => setRechazandoMotivo(e.target.value)}
                rows={3}
                placeholder="Describí el motivo del rechazo..."
                style={{ resize: "vertical", fontSize: "13px" }}
              />
            </Field>
            <div style={{ display: "flex", gap: "10px", marginTop: "16px", justifyContent: "flex-end" }}>
              <button onClick={() => setRechazandoId(null)} style={cancelBtn}>Cancelar</button>
              <button
                onClick={() => handleRechazar(rechazandoId, rechazandoMotivo)}
                disabled={saving || !rechazandoMotivo.trim()}
                style={{ ...primaryBtn, background: "#993C1D" }}
              >
                {saving ? "Procesando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "10px", fontWeight: "600", color: "#6b7280", marginBottom: "3px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: "7px",
  background: "#185fa5", color: "white", border: "none",
  borderRadius: "8px", padding: "8px 16px",
  fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit",
};
const cancelBtn: React.CSSProperties = {
  background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)",
  borderRadius: "8px", padding: "9px 20px",
  fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit",
};
const iconBtn: React.CSSProperties = {
  background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.10)",
  borderRadius: "7px", width: "30px", height: "30px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", color: "#6b7280",
};
