"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Users, Clock, X, Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AppLayout } from "@/components/AppLayout";

const CLASS_COLORS: Record<string, { dot: string; label: string }> = {
  KR: { dot: "#185fa5", label: "Factura" },
  KN: { dot: "#0F6E56", label: "N/C" },
  KD: { dot: "#854F0B", label: "N/D" },
  KZ: { dot: "#6b7280", label: "Pago" },
};

export default function CuentasCorrientesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [mainTab, setMainTab] = useState<"aging" | "partidas">("aging");

  // ── Aging ─────────────────────────────────────────────
  const [aging, setAging] = useState<any[]>([]);
  const [loadingAging, setLoadingAging] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [historial, setHistorial] = useState<any | null>(null);

  // ── Partidas ──────────────────────────────────────────
  const [partidas, setPartidas] = useState<any>(null);
  const [loadingPartidas, setLoadingPartidas] = useState(false);
  const [soloAbiertas, setSoloAbiertas] = useState(true);
  const [searchPartidas, setSearchPartidas] = useState("");
  const [expandedProv, setExpandedProv] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/cuentas-corrientes")
        .then(r => r.ok ? r.json() : [])
        .then(d => { setAging(d); setLoadingAging(false); });
    }
  }, [status]);

  const fetchPartidas = async () => {
    setLoadingPartidas(true);
    const res = await fetch(`/api/partidas?solo_abiertas=${soloAbiertas}`);
    if (res.ok) setPartidas(await res.json());
    setLoadingPartidas(false);
  };

  useEffect(() => {
    if (status === "authenticated" && mainTab === "partidas") fetchPartidas();
  }, [status, mainTab, soloAbiertas]);

  const verHistorial = async (proveedorId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistorial({ loading: true });
    const res = await fetch(`/api/cuentas-corrientes?proveedor_id=${proveedorId}`);
    if (res.ok) setHistorial(await res.json());
    else setHistorial(null);
  };

  const totalGeneral = aging.reduce((s, p) => s + p.total, 0);
  const colAging = [
    { key: "corriente",   label: "Corriente",  color: "#0F6E56", bg: "#e6f4f0" },
    { key: "vencida_30",  label: "1-30 días",  color: "#854F0B", bg: "#fef3e2" },
    { key: "vencida_60",  label: "31-60 días", color: "#993C1D", bg: "#f9ece7" },
    { key: "vencida_90",  label: "61-90 días", color: "#7c1a0a", bg: "#fde8e2" },
    { key: "vencida_mas", label: "> 90 días",  color: "#4a0a04", bg: "#fdd8d0" },
  ];

  const filteredProveedores = (partidas?.proveedores ?? []).filter((p: any) =>
    !searchPartidas ||
    p.razon_social?.toLowerCase().includes(searchPartidas.toLowerCase()) ||
    p.cuit?.includes(searchPartidas)
  );

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", flexShrink: 0 }}>
        <h1 style={{ fontSize: "16px", fontWeight: "600", margin: 0 }}>Cuentas corrientes — Proveedores</h1>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

        {/* Main Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "0.5px solid #e5e7eb", marginBottom: "24px" }}>
          {[
            { key: "aging",    label: "Aging de deuda" },
            { key: "partidas", label: "Lista PI de acreedores (SAP)" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setMainTab(t.key as any)}
              style={{
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                fontSize: "14px", fontWeight: mainTab === t.key ? "700" : "500",
                color: mainTab === t.key ? "#111827" : "#6b7280",
                padding: "10px 20px",
                borderBottom: mainTab === t.key ? "2px solid #111827" : "2px solid transparent",
                marginBottom: "-0.5px",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ───── AGING TAB ───── */}
        {mainTab === "aging" && (
          <>
            <p style={{ fontSize: "13px", color: "#6b7280", margin: "0 0 20px" }}>
              Saldos pendientes de pago agrupados por proveedor con análisis de antigüedad.
            </p>
            {!loadingAging && aging.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px", marginBottom: "24px" }}>
                <div style={{ background: "white", borderRadius: "10px", padding: "12px 16px", border: "0.5px solid rgba(0,0,0,0.10)" }}>
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>Total general</div>
                  <div style={{ fontSize: "18px", fontWeight: "700", color: "#374151" }}>{formatCurrency(totalGeneral)}</div>
                </div>
                {colAging.map(col => {
                  const total = aging.reduce((s, p) => s + (p[col.key] || 0), 0);
                  return (
                    <div key={col.key} style={{ background: col.bg, borderRadius: "10px", padding: "12px 16px", border: `0.5px solid ${col.color}22` }}>
                      <div style={{ fontSize: "11px", color: col.color, opacity: 0.8 }}>{col.label}</div>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: col.color }}>{formatCurrency(total)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
              {loadingAging ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
              ) : aging.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center" }}>
                  <Users size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: "14px", color: "#9ca3af" }}>No hay facturas pendientes de pago</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: "24px" }} />
                      <th>Proveedor</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                      {colAging.map(col => (
                        <th key={col.key} style={{ textAlign: "right" }}>
                          <span style={{ background: col.bg, color: col.color, padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "700" }}>
                            {col.label}
                          </span>
                        </th>
                      ))}
                      <th style={{ textAlign: "right" }}>Facturas</th>
                      <th>Historial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aging.map((prov: any) => (
                      <>
                        <tr key={prov.proveedor_id} style={{ cursor: "pointer", fontWeight: "600" }} onClick={() => setExpanded(expanded === prov.proveedor_id ? null : prov.proveedor_id)}>
                          <td>{expanded === prov.proveedor_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                          <td>
                            <div>{prov.razon_social}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "400" }}>{prov.cuit}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "700" }}>{formatCurrency(prov.total)}</td>
                          {colAging.map(col => (
                            <td key={col.key} style={{ textAlign: "right", color: prov[col.key] > 0 ? col.color : "#d1d5db", fontWeight: prov[col.key] > 0 ? "600" : "400" }}>
                              {prov[col.key] > 0 ? formatCurrency(prov[col.key]) : "—"}
                            </td>
                          ))}
                          <td style={{ textAlign: "right", color: "#6b7280" }}>{prov.facturas.length}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <button onClick={e => verHistorial(prov.proveedor_id, e)} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f0f2f5", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "11px", color: "#374151", fontWeight: "600", fontFamily: "inherit" }}>
                              <Clock size={12} /> CC completa
                            </button>
                          </td>
                        </tr>
                        {expanded === prov.proveedor_id && (
                          <tr key={`det-${prov.proveedor_id}`}>
                            <td colSpan={9} style={{ background: "#f7f8fa", padding: "0 0 0 40px" }}>
                              <table className="data-table" style={{ margin: 0 }}>
                                <thead>
                                  <tr>
                                    <th>Comprobante</th>
                                    <th>Fecha emisión</th>
                                    <th>Fecha vencimiento</th>
                                    <th style={{ textAlign: "right" }}>Importe</th>
                                    <th style={{ textAlign: "right" }}>Días vencida</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {prov.facturas.map((f: any) => (
                                    <tr key={f.id}>
                                      <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{f.tipo_comprobante}-{f.numero}</td>
                                      <td style={{ fontSize: "12px" }}>{formatDate(f.fecha_emision)}</td>
                                      <td style={{ fontSize: "12px" }}>{formatDate(f.fecha_vencimiento)}</td>
                                      <td style={{ textAlign: "right", fontWeight: "600" }}>{formatCurrency(f.importe_total)}</td>
                                      <td style={{ textAlign: "right" }}>
                                        {f.dias_vencida > 0 ? (
                                          <span style={{ background: f.dias_vencida > 90 ? "#fdd8d0" : f.dias_vencida > 60 ? "#f9ece7" : f.dias_vencida > 30 ? "#fef3e2" : "#f9ece7", color: f.dias_vencida > 90 ? "#4a0a04" : f.dias_vencida > 60 ? "#7c1a0a" : f.dias_vencida > 30 ? "#993C1D" : "#854F0B", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>
                                            {f.dias_vencida} días
                                          </span>
                                        ) : (
                                          <span style={{ background: "#e6f4f0", color: "#0F6E56", padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>Corriente</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* ───── PARTIDAS SAP TAB ───── */}
        {mainTab === "partidas" && (
          <>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
              <input
                placeholder="Buscar proveedor o CUIT..."
                value={searchPartidas}
                onChange={e => setSearchPartidas(e.target.value)}
                style={{ fontSize: "13px", border: "0.5px solid #e5e7eb", borderRadius: "8px", padding: "8px 12px", width: "280px" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={soloAbiertas} onChange={e => setSoloAbiertas(e.target.checked)} />
                Solo partidas abiertas
              </label>
              {partidas && (
                <span style={{ marginLeft: "auto", fontSize: "13px", color: "#6b7280" }}>
                  Total: <strong>{formatCurrency(partidas.total_general ?? 0)}</strong>
                </span>
              )}
            </div>

            {/* SAP-style blocks */}
            {loadingPartidas ? (
              <div style={{ padding: "60px", textAlign: "center", color: "#6b7280" }}>Cargando partidas...</div>
            ) : filteredProveedores.length === 0 ? (
              <div style={{ padding: "60px", textAlign: "center" }}>
                <Users size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: "14px", color: "#9ca3af" }}>Sin partidas para los filtros seleccionados</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredProveedores.map((prov: any) => {
                  const open = expandedProv === prov.proveedor_id;
                  return (
                    <div key={prov.proveedor_id} style={{ background: "white", borderRadius: "10px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
                      {/* Proveedor header */}
                      <div
                        onClick={() => setExpandedProv(open ? null : prov.proveedor_id)}
                        style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", cursor: "pointer", background: open ? "#f8fbff" : "white" }}
                      >
                        {open ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />}
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: "700", fontSize: "14px" }}>{prov.razon_social}</span>
                          <span style={{ marginLeft: "10px", fontSize: "11px", color: "#9ca3af", fontFamily: "monospace" }}>{prov.cuit}</span>
                        </div>
                        <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color: prov.saldo > 0 ? "#993C1D" : "#0F6E56" }}>
                          {prov.saldo > 0 ? "+" : ""}{formatCurrency(prov.saldo)}
                        </span>
                        <span style={{ fontSize: "11px", color: "#9ca3af", marginLeft: "8px" }}>{prov.movimientos.length} partida{prov.movimientos.length !== 1 ? "s" : ""}</span>
                      </div>

                      {/* Movements table */}
                      {open && (
                        <div style={{ borderTop: "0.5px solid #f0f0f0" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ background: "#f9fafb", borderBottom: "0.5px solid #e5e7eb" }}>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px", fontFamily: "monospace" }}>St</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Div</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Referencia</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>N°doc</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Clase</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Fecha doc</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Fe.contab</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Ve</th>
                                <th style={{ padding: "7px 10px", textAlign: "right", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Importe ML</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>ML</th>
                                <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: "600", color: "#6b7280", fontSize: "11px" }}>Texto</th>
                                <th style={{ padding: "7px 6px" }} />
                              </tr>
                            </thead>
                            <tbody>
                              {prov.movimientos.map((mov: any, idx: number) => {
                                const cl = CLASS_COLORS[mov.clase] || { dot: "#6b7280", label: mov.clase };
                                const vencida = mov.es_vencida === 1;
                                return (
                                  <tr key={idx} style={{ borderBottom: "0.5px solid #f3f4f6" }}>
                                    <td style={{ padding: "7px 10px" }}>
                                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: vencida ? "#993C1D" : cl.dot }} />
                                    </td>
                                    <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px" }}>{mov.div}</td>
                                    <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px" }}>{mov.referencia || "—"}</td>
                                    <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px" }}>{mov.nro_doc}</td>
                                    <td style={{ padding: "7px 10px" }}>
                                      <span style={{ background: `${cl.dot}22`, color: cl.dot, fontSize: "10px", fontWeight: "700", padding: "1px 7px", borderRadius: "8px" }}>{mov.clase}</span>
                                    </td>
                                    <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px" }}>{formatDate(mov.fecha_doc)}</td>
                                    <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px" }}>{formatDate(mov.fe_contab)}</td>
                                    <td style={{ padding: "7px 10px", fontFamily: "monospace", fontSize: "11px", color: vencida ? "#993C1D" : "" }}>
                                      {mov.fecha_vencimiento ? formatDate(mov.fecha_vencimiento) : "—"}
                                    </td>
                                    <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", fontWeight: "600", color: mov.importe < 0 ? "#0F6E56" : "#374151" }}>
                                      {formatCurrency(mov.importe)}
                                    </td>
                                    <td style={{ padding: "7px 10px", fontSize: "11px", color: "#9ca3af" }}>{mov.moneda}</td>
                                    <td style={{ padding: "7px 10px", fontSize: "11px", color: "#6b7280", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mov.texto || "—"}</td>
                                    <td style={{ padding: "7px 6px" }}>
                                      {mov.clase === "KR" && (
                                        <button
                                          title="Agregar al lote de pago"
                                          style={{ background: "#e8f0fa", border: "none", borderRadius: "5px", padding: "3px 7px", cursor: "pointer", color: "#185fa5", fontSize: "10px", fontWeight: "600", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "3px" }}
                                        >
                                          <Plus size={10} /> Lote
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr style={{ background: "#fffbeb", borderTop: "0.5px solid #d97706" }}>
                                <td colSpan={8} style={{ padding: "7px 10px", fontSize: "11px", fontWeight: "700", color: "#854F0B", fontFamily: "monospace" }}>
                                  Total {prov.razon_social}
                                </td>
                                <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", fontWeight: "700", color: prov.saldo > 0 ? "#993C1D" : "#0F6E56" }}>
                                  {formatCurrency(prov.saldo)}
                                </td>
                                <td colSpan={3} style={{ padding: "7px 10px", fontSize: "11px", color: "#854F0B" }}>ARS</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Total general row */}
                <div style={{ background: "#fef3e2", border: "0.5px solid #d97706", borderRadius: "10px", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color: "#854F0B" }}>TOTAL GENERAL</span>
                  <span style={{ fontFamily: "monospace", fontSize: "16px", fontWeight: "700", color: "#993C1D" }}>{formatCurrency(partidas.total_general ?? 0)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal historial CC completa */}
      {historial && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setHistorial(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "860px", maxHeight: "85vh", overflowY: "auto" }}>
            <button onClick={() => setHistorial(null)} style={{ position: "absolute", top: "16px", right: "16px", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
              <X size={20} />
            </button>
            {historial.loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando historial...</div>
            ) : (
              <>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "16px", fontWeight: "700" }}>{historial.proveedor?.razon_social}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>CUIT {historial.proveedor?.cuit}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
                  {colAging.map(col => historial.aging?.[col.key] > 0 && (
                    <div key={col.key} style={{ background: col.bg, color: col.color, padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "600" }}>
                      {col.label}: {formatCurrency(historial.aging[col.key])}
                    </div>
                  ))}
                  <div style={{ background: "#e8f0fa", color: "#185fa5", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: "700", marginLeft: "auto" }}>
                    Saldo actual: {formatCurrency(historial.saldo_actual ?? 0)}
                  </div>
                </div>
                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Referencia</th>
                        <th>Estado</th>
                        <th style={{ textAlign: "right" }}>Cargo (+)</th>
                        <th style={{ textAlign: "right" }}>Pago (−)</th>
                        <th style={{ textAlign: "right" }}>Saldo corrido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(historial.movimientos ?? []).map((mov: any, i: number) => {
                        const esPago = mov.es_pago === 1 || mov.es_pago === true;
                        return (
                          <tr key={i}>
                            <td style={{ fontSize: "12px" }}>{formatDate(mov.fecha)}</td>
                            <td><span style={{ background: esPago ? "#e6f4f0" : "#e8f0fa", color: esPago ? "#0F6E56" : "#185fa5", padding: "2px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>{esPago ? "Pago" : "Factura"}</span></td>
                            <td style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "600" }}>{mov.referencia}</td>
                            <td style={{ fontSize: "11px", color: "#9ca3af" }}>{mov.estado}</td>
                            <td style={{ textAlign: "right", color: esPago ? "#d1d5db" : "#374151" }}>{!esPago ? formatCurrency(Math.abs(mov.monto)) : "—"}</td>
                            <td style={{ textAlign: "right", color: esPago ? "#0F6E56" : "#d1d5db" }}>{esPago ? formatCurrency(Math.abs(mov.monto)) : "—"}</td>
                            <td style={{ textAlign: "right", fontWeight: "700", color: mov.saldo_corrido > 0 ? "#374151" : "#0F6E56" }}>{formatCurrency(mov.saldo_corrido)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {(historial.movimientos ?? []).length === 0 && (
                    <div style={{ padding: "24px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Sin movimientos registrados.</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
