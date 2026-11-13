"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Plus, X, Check, Loader2, AlertTriangle, ChevronDown, ChevronRight,
  FileText, Trash2, Upload, CreditCard, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const ESTADO_ORDEN: Record<string, { label: string; bg: string; color: string }> = {
  borrador: { label: "Borrador",  bg: "#f0f2f5", color: "#6b7280" },
  emitida:  { label: "Emitida",   bg: "#e8f0fa", color: "#185fa5" },
  pagada:   { label: "Pagada",    bg: "#e6f4f0", color: "#0F6E56" },
};

export default function OrdenesPagoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Record<number, any>>({});

  // Wizard state
  const [step, setStep] = useState(1);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [numero, setNumero] = useState("");
  const [cuentaBancariaId, setCuentaBancariaId] = useState("");
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [facturasDisp, setFacturasDisp] = useState<any[]>([]);
  const [facturasSelec, setFacturasSelec] = useState<Set<number>>(new Set());
  const [retConfigs, setRetConfigs] = useState<any[]>([]);
  const [retenciones, setRetenciones] = useState<any[]>([]);
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [anticipoImporte, setAnticipoImporte] = useState("");
  const [facturaMontos, setFacturaMontos] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pagarModal, setPagarModal] = useState<any>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/ordenes-pago");
    if (res.ok) setOrdenes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { if (status === "authenticated") fetchOrdenes(); }, [status, fetchOrdenes]);

  const openNew = async () => {
    const [pRes, cRes, rRes] = await Promise.all([
      fetch("/api/proveedores"),
      fetch("/api/bancos"),
      fetch("/api/retenciones-config"),
    ]);
    if (pRes.ok) setProveedores(await pRes.ok ? await pRes.json() : []);
    if (cRes.ok) setCuentas(await cRes.json());
    if (rRes.ok) setRetConfigs((await rRes.json()).filter((r: any) => r.activo));
    setProveedorId(""); setFecha(new Date().toISOString().split("T")[0]);
    setNumero(`OP-${Date.now().toString().slice(-6)}`);
    setCuentaBancariaId(""); setFacturasSelec(new Set()); setRetenciones([]);
    setEsAnticipo(false); setAnticipoImporte(""); setFacturaMontos({});
    setStep(1); setError(""); setShowNew(true);
  };

  const loadFacturasProveedor = async (pid: string) => {
    if (!pid) return;
    const res = await fetch(`/api/facturas-recibidas?proveedor_id=${pid}&estado=pendiente_pago`);
    if (res.ok) setFacturasDisp(await res.json());
    else setFacturasDisp([]);
  };

  const toggleFactura = (id: number) => {
    setFacturasSelec(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const seleccionadas = facturasDisp.filter(f => facturasSelec.has(Number(f.id)));
  const importeBruto = esAnticipo
    ? (parseFloat(anticipoImporte) || 0)
    : seleccionadas.reduce((s, f) => {
        const parcial = facturaMontos[Number(f.id)];
        return s + (parcial !== undefined ? parcial : Number(f.importe_total));
      }, 0);

  const calcularRetenciones = async () => {
    if (esAnticipo) { setRetenciones([]); setStep(3); return; }
    const ids = Array.from(facturasSelec).join(",");
    const res = await fetch(
      `/api/ordenes-pago/calcular-retenciones?proveedor_id=${proveedorId}&factura_ids=${ids}&fecha=${fecha}`
    );
    if (!res.ok) { setError("Error al calcular retenciones"); return; }
    const data = await res.json();
    const nuevas = data.retenciones
      .filter((r: any) => r.importe > 0)
      .map((r: any) => ({ ...r, _activo: true }));
    setRetenciones(nuevas);
    setStep(3);
  };

  const totalRetenciones = retenciones.filter(r => r._activo).reduce((s, r) => s + Number(r.importe), 0);
  const importeNeto = importeBruto - totalRetenciones;

  const handleSave = async (estadoFinal: "borrador" | "emitida" | "pagada") => {
    if (!proveedorId || !fecha || !numero) {
      setError("Completá todos los campos obligatorios"); return;
    }
    if (!esAnticipo && facturasSelec.size === 0) {
      setError("Seleccioná al menos una factura o marcá como anticipo"); return;
    }
    if (esAnticipo && !(parseFloat(anticipoImporte) > 0)) {
      setError("Ingresá el importe del anticipo"); return;
    }
    setSaving(true); setError("");
    const body: any = {
      proveedor_id: Number(proveedorId),
      fecha, numero,
      factura_ids: esAnticipo ? [] : Array.from(facturasSelec),
      factura_importes: esAnticipo ? {} : facturaMontos,
      retenciones: retenciones.filter(r => r._activo).map(r => ({
        config_id: r.config_id, tipo: r.tipo, descripcion: r.descripcion,
        codigo_regimen: r.codigo_regimen, base_calculo: r.base_calculo,
        alicuota: r.alicuota, importe: r.importe,
      })),
      cuenta_bancaria_id: cuentaBancariaId || null,
      estado: estadoFinal,
      es_anticipo: esAnticipo,
      concepto: esAnticipo ? `Anticipo ${numero}` : "",
    };
    if (esAnticipo) body.importe_bruto = parseFloat(anticipoImporte) || 0;
    const res = await fetch("/api/ordenes-pago", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Error"); setSaving(false); return; }
    setShowNew(false); fetchOrdenes();
    setSaving(false);
  };

  const loadDetalle = async (id: number) => {
    if (detalle[id]) { setExpanded(expanded === id ? null : id); return; }
    const res = await fetch(`/api/ordenes-pago/${id}`);
    if (res.ok) { const data = await res.json(); setDetalle(prev => ({ ...prev, [id]: data })); }
    setExpanded(id);
  };

  const handlePagar = async () => {
    if (!pagarModal) return;
    setSaving(true);
    let res;
    if (comprobante) {
      const fd = new FormData();
      fd.append("comprobante", comprobante);
      res = await fetch(`/api/ordenes-pago/${pagarModal.id}/pagar`, { method: "POST", body: fd });
    } else {
      res = await fetch(`/api/ordenes-pago/${pagarModal.id}/pagar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    }
    if (res.ok) {
      setPagarModal(null); setComprobante(null);
      setDetalle(prev => { const n = { ...prev }; delete n[pagarModal.id]; return n; });
      fetchOrdenes();
    }
    setSaving(false);
  };

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Órdenes de pago</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Agrupa facturas, calcula retenciones automáticamente y registra pagos.
          </p>
        </div>
        {role === "admin" && (
          <button onClick={openNew} style={primaryBtnSt}>
            <Plus size={15} /> Nueva orden
          </button>
        )}
      </div>

      {/* Tabla principal */}
      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : ordenes.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <CreditCard size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: "14px", color: "#9ca3af" }}>Aún no hay órdenes de pago</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: "24px" }} />
                <th>N° Orden</th>
                <th>Proveedor</th>
                <th>Fecha</th>
                <th style={{ textAlign: "right" }}>Bruto</th>
                <th style={{ textAlign: "right" }}>Retenciones</th>
                <th style={{ textAlign: "right" }}>Neto a pagar</th>
                <th>Estado</th>
                {role === "admin" && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {ordenes.map((op: any) => {
                const est = ESTADO_ORDEN[op.estado] || ESTADO_ORDEN.borrador;
                const det = detalle[op.id];
                return (
                  <>
                    <tr key={op.id} style={{ cursor: "pointer" }} onClick={() => loadDetalle(Number(op.id))}>
                      <td>{expanded === Number(op.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td style={{ fontFamily: "monospace", fontWeight: "700" }}>{op.numero}{op.op_nro_tango ? <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 400 }}>Tango {op.op_nro_tango}</div> : null}</td>
                      <td>
                        <div style={{ fontWeight: "600" }}>{op.razon_social}</div>
                        <div style={{ fontSize: "11px", color: "#9ca3af" }}>{op.cuit}</div>
                      </td>
                      <td style={{ fontSize: "12px" }}>{formatDate(op.fecha)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(op.importe_bruto)}</td>
                      <td style={{ textAlign: "right", color: "#993C1D" }}>{formatCurrency(op.total_retenciones)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>{formatCurrency(op.importe_neto)}</td>
                      <td><span style={{ background: est.bg, color: est.color, padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "700", textTransform: "uppercase" }}>{est.label}</span></td>
                      {role === "admin" && (
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <a href={`/api/ordenes-pago/${op.id}/pdf`} target="_blank" rel="noopener noreferrer" title="Orden de pago (PDF)"
                              style={{ display: "flex", alignItems: "center", gap: "3px", padding: "0 7px", height: "26px", borderRadius: "6px", border: "0.5px solid #e5e7eb", textDecoration: "none", color: "#185fa5", fontSize: "11px", fontWeight: 600 }}>
                              <Download size={12} /> OP
                            </a>
                            {Number(op.total_retenciones) > 0 && (
                              <a href={`/api/ordenes-pago/${op.id}/pdf?tipo=retencion`} target="_blank" rel="noopener noreferrer" title="Comprobante de retención (PDF)"
                                style={{ display: "flex", alignItems: "center", gap: "3px", padding: "0 7px", height: "26px", borderRadius: "6px", border: "0.5px solid #e5e7eb", textDecoration: "none", color: "#993C1D", fontSize: "11px", fontWeight: 600 }}>
                                <Download size={12} /> Ret.
                              </a>
                            )}
                            {(op as any).tango_pdf_path && (
                              <a href={`/api/ordenes-pago/${op.id}/pdf?original=1`} target="_blank" rel="noopener noreferrer" title="PDF original de Tango"
                                style={{ display: "flex", alignItems: "center", gap: "3px", padding: "0 7px", height: "26px", borderRadius: "6px", border: "0.5px solid #e5e7eb", textDecoration: "none", color: "#6b7280", fontSize: "11px", fontWeight: 600 }}>
                                <FileText size={12} /> Tango
                              </a>
                            )}
                            {(op.comprobante_path || op.comprobante_paths) && (
                              <a
                                href={`/api/pdf/${String(op.comprobante_path || op.comprobante_paths).split(";")[0].trim().replace(/^facturas-pdf\//, '').split("/").map(encodeURIComponent).join("/")}`}
                                target="_blank" rel="noopener noreferrer" title="Ver comprobante de pago del banco"
                                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "6px", border: "0.5px solid #e5e7eb", textDecoration: "none", color: "#185fa5" }}
                              >
                                <FileText size={13} />
                              </a>
                            )}
                            {op.estado !== "pagada" && (
                              <button
                                onClick={() => setPagarModal(op)}
                                style={{ background: "#e6f4f0", border: "none", borderRadius: "6px", padding: "4px 10px", cursor: "pointer", fontSize: "11px", color: "#0F6E56", fontWeight: "600", fontFamily: "inherit" }}
                              >
                                Pagar
                              </button>
                            )}
                            {op.estado === "borrador" && (
                              <button
                                onClick={async () => { if (!confirm("¿Eliminar borrador?")) return; await fetch(`/api/ordenes-pago/${op.id}`, { method: "DELETE" }); fetchOrdenes(); }}
                                style={iconBtnSt}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    {expanded === Number(op.id) && det && (
                      <tr key={`det-${op.id}`}>
                        <td colSpan={role === "admin" ? 9 : 8} style={{ background: "#f7f8fa", padding: "16px 24px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>Facturas incluidas</div>
                              {det.items?.map((item: any) => (
                                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0", borderBottom: "0.5px solid #e5e7eb" }}>
                                  <span style={{ fontFamily: "monospace" }}>{item.tipo_comprobante}-{item.numero}</span>
                                  <span>{formatDate(item.fecha_emision)}</span>
                                  <span style={{ fontWeight: "600" }}>{formatCurrency(item.importe_total)}</span>
                                </div>
                              ))}
                            </div>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>Retenciones aplicadas</div>
                              {det.retenciones?.length === 0 && <div style={{ fontSize: "12px", color: "#9ca3af" }}>Sin retenciones</div>}
                              {det.retenciones?.map((ret: any) => (
                                <div key={ret.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "4px 0", borderBottom: "0.5px solid #e5e7eb" }}>
                                  <span>{ret.descripcion}</span>
                                  <span style={{ color: "#993C1D", fontWeight: "600" }}>− {formatCurrency(ret.importe)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
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

      {/* Modal nueva orden — wizard 3 pasos */}
      {showNew && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowNew(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "700px", maxHeight: "90vh", overflowY: "auto" }}>
            {/* Stepper */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
              {["Proveedor y facturas", "Verificar facturas", "Retenciones y confirmar"].map((label, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", flex: i < 2 ? "1" : undefined }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: step > i + 1 ? "#0F6E56" : step === i + 1 ? "#185fa5" : "#e5e7eb",
                    color: step >= i + 1 ? "white" : "#9ca3af", fontSize: "12px", fontWeight: "700", flexShrink: 0,
                  }}>
                    {step > i + 1 ? <Check size={12} /> : i + 1}
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: step === i + 1 ? "600" : "400", color: step === i + 1 ? "#185fa5" : "#6b7280", whiteSpace: "nowrap" }}>{label}</span>
                  {i < 2 && <div style={{ flex: 1, height: "1px", background: step > i + 1 ? "#0F6E56" : "#e5e7eb" }} />}
                </div>
              ))}
            </div>

            {/* PASO 1 */}
            {step === 1 && (
              <div>
                <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "16px" }}>Seleccionar proveedor y datos básicos</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={labelSt}>Proveedor *</label>
                    <select value={proveedorId} onChange={e => { setProveedorId(e.target.value); loadFacturasProveedor(e.target.value); setFacturasSelec(new Set()); }}>
                      <option value="">— Seleccionar —</option>
                      {proveedores.map((p: any) => <option key={p.id} value={p.id}>{p.razon_social} ({p.cuit})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelSt}>Fecha *</label>
                    <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
                  </div>
                  <div>
                    <label style={labelSt}>N° Orden *</label>
                    <input value={numero} onChange={e => setNumero(e.target.value)} placeholder="OP-001" />
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={labelSt}>Cuenta bancaria de egreso</label>
                    <select value={cuentaBancariaId} onChange={e => setCuentaBancariaId(e.target.value)}>
                      <option value="">— Sin especificar —</option>
                      {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.banco} – {c.tipo} ({c.moneda})</option>)}
                    </select>
                  </div>
                </div>
                {/* Anticipo toggle */}
                <div style={{ marginTop: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" checked={esAnticipo} onChange={e => { setEsAnticipo(e.target.checked); setFacturasSelec(new Set()); }} />
                    <strong>Es un anticipo</strong> (pago sin factura específica)
                  </label>
                  {esAnticipo && (
                    <div style={{ marginTop: "10px" }}>
                      <label style={labelSt}>Importe del anticipo *</label>
                      <input type="number" value={anticipoImporte} onChange={e => setAnticipoImporte(e.target.value)} placeholder="0.00" style={{ maxWidth: "200px" }} />
                    </div>
                  )}
                </div>

                {!esAnticipo && proveedorId && facturasDisp.length === 0 && (
                  <div style={{ marginTop: "12px", padding: "12px", background: "#fef3e2", borderRadius: "8px", fontSize: "13px", color: "#854F0B" }}>
                    Este proveedor no tiene facturas pendientes de pago.
                  </div>
                )}
                {!esAnticipo && facturasDisp.length > 0 && (
                  <div style={{ marginTop: "16px" }}>
                    <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
                      Facturas pendientes ({facturasDisp.length}) — seleccioná las que vas a pagar
                    </div>
                    <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                      {facturasDisp.map((f: any) => {
                        const sel = facturasSelec.has(Number(f.id));
                        const parcial = facturaMontos[Number(f.id)];
                        return (
                          <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderBottom: "0.5px solid #e5e7eb", background: sel ? "#f0f6ff" : "white" }}>
                            <input type="checkbox" checked={sel} onChange={() => toggleFactura(Number(f.id))} style={{ cursor: "pointer" }} />
                            <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "600", minWidth: "120px" }}>{f.tipo_comprobante}-{f.numero}</span>
                            <span style={{ fontSize: "12px", color: "#6b7280" }}>{formatDate(f.fecha_emision)}</span>
                            <span style={{ marginLeft: "auto", fontSize: "12px", color: "#6b7280" }}>Total: {formatCurrency(f.importe_total)}</span>
                            {sel && (
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <label style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap" }}>Pagar:</label>
                                <input
                                  type="number"
                                  value={parcial !== undefined ? parcial : Number(f.importe_total)}
                                  min={0}
                                  max={Number(f.importe_total)}
                                  step={0.01}
                                  onChange={e => setFacturaMontos(prev => ({ ...prev, [Number(f.id)]: parseFloat(e.target.value) || 0 }))}
                                  style={{ width: "100px", textAlign: "right", padding: "3px 6px", border: "0.5px solid #e5e7eb", borderRadius: "5px", fontFamily: "inherit", fontSize: "12px" }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px" }}>
                      Podés ajustar el importe a pagar por factura para pagos parciales.
                    </div>
                  </div>
                )}
                {error && <ErrBox msg={error} />}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button onClick={() => setShowNew(false)} style={cancelBtnSt}>Cancelar</button>
                  <button
                    onClick={() => {
                      if (!proveedorId || !fecha || !numero) { setError("Completá proveedor, fecha y número de orden"); return; }
                      if (esAnticipo && !(parseFloat(anticipoImporte) > 0)) { setError("Ingresá el importe del anticipo"); return; }
                      if (!esAnticipo && facturasSelec.size === 0) { setError("Seleccioná al menos una factura o marcá como anticipo"); return; }
                      setError(""); setStep(2);
                    }}
                    style={primaryBtnSt}
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2 — resumen facturas */}
            {step === 2 && (
              <div>
                <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "16px" }}>
                  {esAnticipo ? "Confirmar anticipo" : "Confirmar facturas seleccionadas"}
                </div>
                {esAnticipo ? (
                  <div style={{ padding: "16px", background: "#f0f6ff", borderRadius: "8px", marginBottom: "16px" }}>
                    <div style={{ fontSize: "13px", color: "#374151", marginBottom: "6px" }}>
                      <strong>Anticipo</strong> — pago sin factura específica
                    </div>
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      Se registrará como anticipo para el proveedor. Podrá imputarse a facturas futuras.
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                    <table className="data-table">
                      <thead><tr><th>Comprobante</th><th>Fecha</th><th style={{ textAlign: "right" }}>Total factura</th><th style={{ textAlign: "right" }}>Importe a pagar</th></tr></thead>
                      <tbody>
                        {seleccionadas.map(f => {
                          const parcial = facturaMontos[Number(f.id)];
                          const pagando = parcial !== undefined ? parcial : Number(f.importe_total);
                          const esParcial = Math.abs(pagando - Number(f.importe_total)) > 0.01;
                          return (
                            <tr key={f.id}>
                              <td style={{ fontFamily: "monospace", fontWeight: "600" }}>{f.tipo_comprobante}-{f.numero}</td>
                              <td>{formatDate(f.fecha_emision)}</td>
                              <td style={{ textAlign: "right", color: "#9ca3af" }}>{formatCurrency(f.importe_total)}</td>
                              <td style={{ textAlign: "right", fontWeight: "700", color: esParcial ? "#854F0B" : "#374151" }}>
                                {formatCurrency(pagando)}
                                {esParcial && <span style={{ fontSize: "10px", marginLeft: "4px" }}>(parcial)</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", background: "#f7f8fa", borderRadius: "8px", fontSize: "14px", fontWeight: "700" }}>
                  <span>Total bruto</span>
                  <span>{formatCurrency(importeBruto)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button onClick={() => setStep(1)} style={cancelBtnSt}>← Atrás</button>
                  <button onClick={calcularRetenciones} style={primaryBtnSt}>Calcular retenciones →</button>
                </div>
              </div>
            )}

            {/* PASO 3 — retenciones y confirmar */}
            {step === 3 && (
              <div>
                <div style={{ fontSize: "15px", fontWeight: "700", marginBottom: "4px" }}>Retenciones y resumen final</div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "16px" }}>
                  Las retenciones se calculan desde la tabla de configuración. Podés activar/desactivar o ajustar importes.
                </div>

                {retenciones.length === 0 ? (
                  <div style={{ padding: "12px", background: "#f7f8fa", borderRadius: "8px", fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                    No hay retenciones activas configuradas.
                  </div>
                ) : (
                  <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: "24px" }} />
                          <th>Régimen / descripción</th>
                          <th>Código</th>
                          <th style={{ textAlign: "right" }}>Base</th>
                          <th style={{ textAlign: "right" }}>Alícuota</th>
                          <th style={{ textAlign: "right" }}>Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {retenciones.map((r, i) => (
                          <tr key={i} style={{ opacity: r._activo ? 1 : 0.4 }}>
                            <td>
                              <input type="checkbox" checked={r._activo} onChange={() => {
                                setRetenciones(prev => prev.map((x, j) => j === i ? { ...x, _activo: !x._activo } : x));
                              }} />
                            </td>
                            <td style={{ fontSize: "12px" }}>{r.descripcion}</td>
                            <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.codigo_regimen || "—"}</td>
                            <td style={{ textAlign: "right" }}>{formatCurrency(r.base_calculo)}</td>
                            <td style={{ textAlign: "right" }}>{(Number(r.alicuota) * 100).toFixed(2)}%</td>
                            <td style={{ textAlign: "right" }}>
                              <input
                                type="number"
                                value={r.importe}
                                onChange={e => setRetenciones(prev => prev.map((x, j) => j === i ? { ...x, importe: parseFloat(e.target.value) || 0 } : x))}
                                style={{ width: "90px", textAlign: "right", padding: "3px 6px", border: "0.5px solid #e5e7eb", borderRadius: "4px", fontFamily: "inherit" }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Resumen */}
                <div style={{ border: "0.5px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", marginBottom: "16px" }}>
                  {[
                    { label: "Importe bruto",       value: importeBruto,      bold: false, color: "#374151" },
                    { label: "Total retenciones",    value: -totalRetenciones, bold: false, color: "#993C1D" },
                    { label: "Neto a pagar",         value: importeNeto,       bold: true,  color: "#0F6E56" },
                  ].map(row => (
                    <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 16px", borderBottom: "0.5px solid #f0f2f5" }}>
                      <span style={{ fontSize: "13px", color: "#6b7280" }}>{row.label}</span>
                      <span style={{ fontSize: "14px", fontWeight: row.bold ? "700" : "400", color: row.color }}>
                        {row.value < 0 ? `− ${formatCurrency(-row.value)}` : formatCurrency(row.value)}
                      </span>
                    </div>
                  ))}
                </div>

                {error && <ErrBox msg={error} />}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                  <button onClick={() => setStep(2)} style={cancelBtnSt}>← Atrás</button>
                  <button onClick={() => handleSave("borrador")} disabled={saving} style={cancelBtnSt}>
                    {saving ? <Loader2 size={13} /> : <FileText size={13} />} Guardar borrador
                  </button>
                  <button onClick={() => handleSave("emitida")} disabled={saving} style={primaryBtnSt}>
                    {saving ? <Loader2 size={14} /> : <Check size={14} />} Emitir orden
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal pagar */}
      {pagarModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => { setPagarModal(null); setComprobante(null); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "440px" }}>
            <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Registrar pago</div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
              Orden <strong>{pagarModal.numero}</strong> — neto a pagar: <strong>{formatCurrency(pagarModal.importe_neto)}</strong>
            </div>
            <label style={labelSt}>Comprobante de pago (PDF, opcional)</label>
            <label style={{ display: "flex", alignItems: "center", gap: "10px", background: comprobante ? "#f7fdf9" : "#f7f8fa", border: `0.5px dashed ${comprobante ? "#0F6E56" : "#c1c7d0"}`, borderRadius: "8px", padding: "12px 16px", cursor: "pointer", marginBottom: "16px" }}>
              <Upload size={16} color={comprobante ? "#0F6E56" : "#185fa5"} />
              <div>
                <div style={{ fontSize: "13px", fontWeight: "500", color: comprobante ? "#0F6E56" : "#374151" }}>{comprobante ? comprobante.name : "Seleccionar PDF"}</div>
                {comprobante && <div style={{ fontSize: "11px", color: "#6b7280" }}>{(comprobante.size / 1024).toFixed(1)} KB</div>}
              </div>
              <input type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setComprobante(f); }} />
            </label>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => { setPagarModal(null); setComprobante(null); }} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handlePagar} disabled={saving} style={{ ...primaryBtnSt, background: "#0F6E56" }}>
                {saving ? <Loader2 size={14} /> : <Check size={14} />} Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "9px 14px", color: "#993C1D", fontSize: "13px", marginTop: "12px", display: "flex", gap: "8px" }}>
      <AlertTriangle size={15} style={{ flexShrink: 0 }} /> {msg}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtnSt: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSt: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
