"use client";

import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Upload, Download, CheckCircle2, AlertTriangle, XCircle,
  FileText, X, Plus, Loader2, AlertCircle, RefreshCw,
} from "lucide-react";
import { formatCurrency, formatDate, calcularIVA } from "@/lib/utils";
import * as XLSX from "xlsx";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ResumenCategoria { count: number; total: number; }
interface ParseError { linea: number; campo: string; mensaje: string; contenido: string; }

interface Resultado {
  parseErrors: ParseError[];
  conciliadas: any[];
  soloARCA: any[];
  soloSistema: any[];
  resumen: { conciliadas: ResumenCategoria; soloARCA: ResumenCategoria; soloSistema: ResumenCategoria };
  modo: "compras" | "ventas";
}

// ─── Formulario "Cargar ahora" ────────────────────────────────────────────────

const TIPOS_IVA = ["21%", "10.5%", "exento", "no_gravado"];

function ModalCargarAhora({
  registro,
  modo,
  onClose,
  onGuardado,
}: {
  registro: any;
  modo: "compras" | "ventas";
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({
    contraparte_id: "",
    tipo_comprobante: String(registro.tipo || "A"),
    numero: registro.numeroRaw || "",
    fecha_emision: registro.fecha || "",
    fecha_vencimiento: registro.fecha || "",
    importe_neto: registro.importe ? String((registro.importe / 1.21).toFixed(2)) : "",
    tipo_iva: "21%",
    importe_iva: "",
    importe_total: registro.importe ? String(registro.importe.toFixed(2)) : "",
    concepto: "",
    estado: modo === "compras" ? "pendiente_pago" : "cobro_pendiente",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Cargar listado al montar
  useEffect(() => {
    const fetchData = async () => {
      if (modo === "compras") {
        const r = await fetch("/api/proveedores");
        const data = await r.json();
        setProveedores(data);
        const match = data.find((p: any) => p.cuit?.replace(/-/g, "") === registro.cuit);
        if (match) setForm(f => ({ ...f, contraparte_id: String(match.id) }));
      } else {
        const r = await fetch("/api/clientes");
        const data = await r.json();
        setClientes(data);
        const match = data.find((c: any) => c.cuit?.replace(/-/g, "") === registro.cuit);
        if (match) setForm(f => ({ ...f, contraparte_id: String(match.id) }));
      }
      setLoaded(true);
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recalcularIVA = (neto: string, tipoIva: string) => {
    const n = parseFloat(neto) || 0;
    const iva = calcularIVA(n, tipoIva);
    setForm(f => ({ ...f, importe_iva: iva.toFixed(2), importe_total: (n + iva).toFixed(2) }));
  };

  const handleSave = async () => {
    if (!form.contraparte_id) { setError("Seleccioná un proveedor/cliente"); return; }
    if (!form.numero || !form.fecha_emision) { setError("Número y fecha son obligatorios"); return; }
    setSaving(true); setError("");
    const body = {
      ...(modo === "compras" ? { proveedor_id: parseInt(form.contraparte_id) } : { cliente_id: parseInt(form.contraparte_id) }),
      tipo_comprobante: form.tipo_comprobante,
      numero: form.numero,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento || form.fecha_emision,
      importe_neto: parseFloat(form.importe_neto) || 0,
      tipo_iva: form.tipo_iva,
      importe_iva: parseFloat(form.importe_iva) || 0,
      importe_total: parseFloat(form.importe_total) || 0,
      concepto: form.concepto,
      estado: form.estado,
    };
    const url = modo === "compras" ? "/api/facturas-recibidas" : "/api/facturas-emitidas";
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) { onGuardado(); }
    else { const e = await res.json(); setError(e.error || "Error al guardar"); }
    setSaving(false);
  };

  const lista = modo === "compras" ? proveedores : clientes;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
      <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "600px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "700" }}>Cargar factura desde ARCA</div>
            <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
              Completá los datos — número y fecha pre-cargados desde el TXT
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}><X size={18} /></button>
        </div>

        {/* Datos pre-llenados de ARCA */}
        <div style={{ background: "#f0f7ff", border: "0.5px solid #c3d9f4", borderRadius: "8px", padding: "12px 14px", marginBottom: "18px", fontSize: "12px" }}>
          <div style={{ fontWeight: "600", color: "#185fa5", marginBottom: "6px" }}>Datos del TXT ARCA:</div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", color: "#374151" }}>
            <span>CUIT: <strong>{registro.cuit}</strong></span>
            <span>Tipo: <strong>{registro.tipo}</strong></span>
            <span>Número: <strong>{registro.numeroRaw}</strong></span>
            <span>Fecha: <strong>{registro.fecha ? formatDate(registro.fecha) : "—"}</strong></span>
            <span>Importe: <strong>{formatCurrency(registro.importe)}</strong></span>
          </div>
        </div>

        {!loaded ? (
          <div style={{ textAlign: "center", padding: "20px", color: "#6b7280" }}>Cargando...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>{modo === "compras" ? "Proveedor *" : "Cliente *"}</label>
              <select value={form.contraparte_id} onChange={e => setForm(f => ({ ...f, contraparte_id: e.target.value }))}>
                <option value="">— Seleccioná —</option>
                {lista.map((item: any) => (
                  <option key={item.id} value={item.id}>
                    {item.razon_social} ({item.cuit})
                  </option>
                ))}
              </select>
              {registro.razon_social && (
                <div style={{ fontSize: "11px", color: "#0F6E56", marginTop: "4px" }}>
                  ✓ Encontrado en sistema: {registro.razon_social}
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>Tipo comprobante</label>
              <input value={form.tipo_comprobante} onChange={e => setForm(f => ({ ...f, tipo_comprobante: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Número *</label>
              <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Fecha emisión *</label>
              <input type="date" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Fecha vencimiento</label>
              <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Importe neto</label>
              <input type="number" value={form.importe_neto} onChange={e => { setForm(f => ({ ...f, importe_neto: e.target.value })); recalcularIVA(e.target.value, form.tipo_iva); }} />
            </div>
            <div>
              <label style={labelStyle}>Tipo IVA</label>
              <select value={form.tipo_iva} onChange={e => { setForm(f => ({ ...f, tipo_iva: e.target.value })); recalcularIVA(form.importe_neto, e.target.value); }}>
                {TIPOS_IVA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>IVA calculado</label>
              <input readOnly value={form.importe_iva} style={{ background: "#f7f8fa", color: "#6b7280" }} />
            </div>
            <div>
              <label style={labelStyle}>Total</label>
              <input type="number" value={form.importe_total} onChange={e => setForm(f => ({ ...f, importe_total: e.target.value }))}
                style={{ fontWeight: "700", color: "#185fa5" }} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={labelStyle}>Concepto</label>
              <input value={form.concepto} onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Descripción del comprobante..." />
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "8px 14px", color: "#993C1D", fontSize: "13px", marginTop: "12px" }}>
            {error}
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={primaryBtnStyle}>
            {saving ? <><Loader2 size={14} className="spin-anim" /> Guardando...</> : <><Plus size={14} /> Guardar factura</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConciliacionPage() {
  const [modo, setModo] = useState<"compras" | "ventas">("compras");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [errorGlobal, setErrorGlobal] = useState("");
  const [tab, setTab] = useState<"conciliadas" | "soloARCA" | "soloSistema">("conciliadas");
  const [registroACargar, setRegistroACargar] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleProcesar = async () => {
    if (!archivo) return;
    setProcesando(true);
    setErrorGlobal("");
    setResultado(null);

    try {
      const contenido = await archivo.text();
      const res = await fetch("/api/conciliacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido, modo }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorGlobal(data.error || "Error al procesar"); }
      else { setResultado(data); setTab("conciliadas"); }
    } catch { setErrorGlobal("Error de conexión al procesar el archivo"); }
    setProcesando(false);
  };

  const resetear = () => {
    setArchivo(null);
    setResultado(null);
    setErrorGlobal("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const exportarExcel = () => {
    if (!resultado) return;
    const wb = XLSX.utils.book_new();
    const cols = ["fecha", "tipo", "numeroRaw", "cuit", "razon_social", "importe"];
    const headers = ["Fecha", "Tipo", "Número", "CUIT", "Razón Social", "Importe"];

    const makeSheet = (data: any[], extra?: (row: any) => any[]) => {
      const rows = data.map(r => {
        const arca = r.arca || r;
        const sis = r.sistema;
        return [
          arca.fecha ? formatDate(arca.fecha) : (sis?.fecha_emision ? formatDate(sis.fecha_emision) : ""),
          arca.tipo || sis?.tipo_comprobante || "",
          arca.numeroRaw || sis?.numero || "",
          arca.cuit || (sis?.cuit_contraparte ? String(sis.cuit_contraparte) : ""),
          arca.razon_social || sis?.razon_social || "",
          arca.importe || sis?.importe_total || 0,
          ...(extra ? extra(r) : []),
        ];
      });
      return XLSX.utils.aoa_to_sheet([headers, ...rows]);
    };

    // Hoja 1: Conciliadas
    const wsConciliadas = makeSheet(resultado.conciliadas, r => [r.sistema?.estado || ""]);
    XLSX.utils.book_append_sheet(wb, wsConciliadas, "Conciliadas");

    // Hoja 2: Falta cargar
    const wsFalta = makeSheet(resultado.soloARCA);
    XLSX.utils.book_append_sheet(wb, wsFalta, "Falta cargar");

    // Hoja 3: Verificar
    const wsVerificar = XLSX.utils.aoa_to_sheet([
      ["Fecha", "Tipo", "Número", "CUIT", "Razón Social", "Importe", "Estado"],
      ...resultado.soloSistema.map(f => [
        f.fecha_emision ? formatDate(f.fecha_emision) : "",
        f.tipo_comprobante || "",
        f.numero || "",
        f.cuit_contraparte || "",
        f.razon_social || "",
        f.importe_total || 0,
        f.estado || "",
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsVerificar, "Verificar");

    XLSX.writeFile(wb, `conciliacion_arca_${modo}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const { resumen, parseErrors } = resultado || {};
  const modoLabel = modo === "compras" ? "Compras — Facturas recibidas" : "Ventas — Facturas emitidas";

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Conciliación ARCA</div>
        {resultado && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={resetear} style={{ ...cancelBtnStyle, display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              <RefreshCw size={13} /> Nueva conciliación
            </button>
            <button onClick={exportarExcel} style={{ ...primaryBtnStyle, gap: "6px" }}>
              <Download size={14} /> Exportar Excel
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: "24px 28px", flex: 1 }}>
        {/* Panel de configuración */}
        {!resultado && (
          <div style={{ background: "white", borderRadius: "12px", padding: "24px", border: "0.5px solid rgba(0,0,0,0.10)", marginBottom: "20px" }}>
            {/* Selector de modo */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "10px" }}>
                Modo de conciliación
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {(["compras", "ventas"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setModo(m)}
                    style={{
                      padding: "8px 20px",
                      borderRadius: "8px",
                      border: `1.5px solid ${modo === m ? "#185fa5" : "rgba(0,0,0,0.12)"}`,
                      background: modo === m ? "#185fa5" : "white",
                      color: modo === m ? "white" : "#374151",
                      fontSize: "13px",
                      fontWeight: modo === m ? "600" : "400",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {m === "compras" ? "📥 Compras — Facturas recibidas" : "📤 Ventas — Facturas emitidas"}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload */}
            <div style={{ fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "8px" }}>
              Archivo TXT de ARCA
            </div>
            <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "12px" }}>
              Exportá desde AFIP/ARCA → {modo === "compras" ? "IVA Compras" : "IVA Ventas"} → Exportar TXT.<br />
              Formato de ancho fijo: Fecha (pos 1-8), Tipo (9-10), Número (11-21), CUIT (30-41), Importe (42-56, 2 decimales implícitos).
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", background: "#f7f8fa", border: "0.5px dashed #c1c7d0", borderRadius: "8px", padding: "12px 20px", cursor: "pointer" }}>
                <Upload size={18} color="#185fa5" />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "500", color: "#374151" }}>
                    {archivo ? archivo.name : "Seleccionar archivo TXT"}
                  </div>
                  {archivo && (
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                      {(archivo.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={e => { setArchivo(e.target.files?.[0] || null); setErrorGlobal(""); }} style={{ display: "none" }} />
              </label>

              <button
                onClick={handleProcesar}
                disabled={!archivo || procesando}
                style={{ ...primaryBtnStyle, opacity: !archivo || procesando ? 0.6 : 1 }}
              >
                {procesando ? <><Loader2 size={15} className="spin-anim" /> Procesando...</> : "Conciliar"}
              </button>
            </div>

            {errorGlobal && (
              <div style={{ marginTop: "14px", background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "10px 14px", color: "#993C1D", fontSize: "13px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
                {errorGlobal}
              </div>
            )}
          </div>
        )}

        {/* Errores de parseo */}
        {resultado && parseErrors && parseErrors.length > 0 && (
          <div style={{ background: "#fef3e2", border: "0.5px solid #f59e0b", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600", color: "#854F0B", marginBottom: "10px" }}>
              <AlertTriangle size={16} />
              {parseErrors.length} línea{parseErrors.length > 1 ? "s" : ""} con errores de formato (omitidas)
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
              {parseErrors.slice(0, 10).map((e, i) => (
                <div key={i} style={{ fontSize: "12px", color: "#92400e" }}>
                  <strong>Línea {e.linea} · {e.campo}:</strong> {e.mensaje}
                  {e.contenido && <code style={{ marginLeft: "6px", background: "#fff3cd", padding: "1px 5px", borderRadius: "4px", fontSize: "11px" }}>&quot;{e.contenido}&quot;</code>}
                </div>
              ))}
              {parseErrors.length > 10 && (
                <div style={{ fontSize: "11px", color: "#92400e" }}>... y {parseErrors.length - 10} errores más</div>
              )}
            </div>
          </div>
        )}

        {/* Resumen */}
        {resultado && resumen && (
          <>
            <div style={{ marginBottom: "8px", fontSize: "13px", color: "#6b7280" }}>
              Conciliación: <strong>{modoLabel}</strong> · archivo: <strong>{archivo?.name}</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "20px" }}>
              <SummaryCard
                label="Conciliadas"
                count={resumen.conciliadas.count}
                total={resumen.conciliadas.total}
                color="#0F6E56"
                bg="#e6f4f0"
                icon={<CheckCircle2 size={20} />}
                onClick={() => setTab("conciliadas")}
                active={tab === "conciliadas"}
              />
              <SummaryCard
                label="Falta cargar en sistema"
                count={resumen.soloARCA.count}
                total={resumen.soloARCA.total}
                color="#b45309"
                bg="#fef3e2"
                icon={<AlertTriangle size={20} />}
                onClick={() => setTab("soloARCA")}
                active={tab === "soloARCA"}
              />
              <SummaryCard
                label="Verificar (solo en sistema)"
                count={resumen.soloSistema.count}
                total={resumen.soloSistema.total}
                color="#993C1D"
                bg="#f9ece7"
                icon={<XCircle size={20} />}
                onClick={() => setTab("soloSistema")}
                active={tab === "soloSistema"}
              />
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", background: "white", borderRadius: "12px 12px 0 0", border: "0.5px solid rgba(0,0,0,0.10)", borderBottom: "none", overflow: "hidden" }}>
              {(["conciliadas", "soloARCA", "soloSistema"] as const).map((key) => {
                const info = {
                  conciliadas: { label: `✓ Conciliadas (${resultado.conciliadas.length})`, color: "#0F6E56" },
                  soloARCA: { label: `! Falta cargar (${resultado.soloARCA.length})`, color: "#b45309" },
                  soloSistema: { label: `× Verificar (${resultado.soloSistema.length})`, color: "#993C1D" },
                }[key];
                return (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    style={{
                      flex: 1, padding: "12px 8px", border: "none", cursor: "pointer",
                      fontSize: "12px", fontWeight: tab === key ? "600" : "400",
                      fontFamily: "inherit",
                      background: tab === key ? "white" : "#f7f8fa",
                      color: tab === key ? info.color : "#6b7280",
                      borderBottom: tab === key ? `2px solid ${info.color}` : "2px solid transparent",
                    }}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>

            {/* Contenido de tab */}
            <div style={{ background: "white", borderRadius: "0 0 12px 12px", border: "0.5px solid rgba(0,0,0,0.10)", borderTop: "none", overflow: "hidden" }}>
              {tab === "conciliadas" && (
                <TabConciliadas rows={resultado.conciliadas} />
              )}
              {tab === "soloARCA" && (
                <TabSoloARCA
                  rows={resultado.soloARCA}
                  modo={modo}
                  onCargarAhora={(reg) => setRegistroACargar(reg)}
                />
              )}
              {tab === "soloSistema" && (
                <TabSoloSistema rows={resultado.soloSistema} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal cargar ahora */}
      {registroACargar && (
        <ModalCargarAhora
          registro={registroACargar}
          modo={modo}
          onClose={() => setRegistroACargar(null)}
          onGuardado={() => {
            setRegistroACargar(null);
            // Re-lanzar conciliación automáticamente
            handleProcesar();
          }}
        />
      )}
    </AppLayout>
  );
}

// ─── Subcomponentes de tabs ───────────────────────────────────────────────────

function TabConciliadas({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty mensaje="Sin comprobantes conciliados" />;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Fecha ARCA</th>
          <th>Tipo</th>
          <th>Número</th>
          <th>CUIT</th>
          <th>Razón Social</th>
          <th style={{ textAlign: "right" }}>Importe ARCA</th>
          <th>Estado sistema</th>
          <th style={{ textAlign: "right" }}>Importe sistema</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: "#f7fdf9" }}>
            <td style={{ fontSize: "12px" }}>{r.arca.fecha ? formatDate(r.arca.fecha) : "—"}</td>
            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{r.arca.tipo}</td>
            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{r.arca.numeroRaw}</td>
            <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.arca.cuit}</td>
            <td style={{ fontSize: "12px" }}>{r.sistema?.razon_social || "—"}</td>
            <td style={{ textAlign: "right", fontSize: "12px" }}>{formatCurrency(r.arca.importe)}</td>
            <td>
              <span style={{ background: "#e6f4f0", color: "#0F6E56", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" }}>
                {r.sistema?.estado || "—"}
              </span>
            </td>
            <td style={{ textAlign: "right", fontWeight: "600", fontSize: "12px" }}>
              {r.sistema ? formatCurrency(r.sistema.importe_total) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabSoloARCA({ rows, modo, onCargarAhora }: { rows: any[]; modo: string; onCargarAhora: (r: any) => void }) {
  if (!rows.length) return <Empty mensaje="Todos los comprobantes de ARCA están en el sistema" icono="✓" />;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Número</th>
          <th>CUIT</th>
          <th>Razón Social</th>
          <th style={{ textAlign: "right" }}>Importe</th>
          <th>Observación</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ background: "#fffbf0" }}>
            <td style={{ fontSize: "12px" }}>{r.fecha ? formatDate(r.fecha) : "—"}</td>
            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{r.tipo}</td>
            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{r.numeroRaw}</td>
            <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{r.cuit}</td>
            <td style={{ fontSize: "12px" }}>{r.razon_social || <span style={{ color: "#d1d5db" }}>No encontrado</span>}</td>
            <td style={{ textAlign: "right", fontWeight: "600", fontSize: "12px" }}>{formatCurrency(r.importe)}</td>
            <td>
              <span style={{ background: "#fef3e2", color: "#b45309", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>
                FALTA EN SISTEMA
              </span>
            </td>
            <td>
              <button
                onClick={() => onCargarAhora(r)}
                style={{ display: "flex", alignItems: "center", gap: "5px", background: "#185fa5", color: "white", border: "none", borderRadius: "6px", padding: "4px 10px", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
              >
                <Plus size={11} /> Cargar ahora
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabSoloSistema({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty mensaje="Todos los comprobantes del sistema están en ARCA" icono="✓" />;
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Tipo</th>
          <th>Número</th>
          <th>CUIT</th>
          <th>Razón Social</th>
          <th style={{ textAlign: "right" }}>Importe</th>
          <th>Estado</th>
          <th>Observación</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((f, i) => (
          <tr key={i} style={{ background: "#fff8f7" }}>
            <td style={{ fontSize: "12px" }}>{f.fecha_emision ? formatDate(f.fecha_emision) : "—"}</td>
            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{f.tipo_comprobante}</td>
            <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{f.numero}</td>
            <td style={{ fontFamily: "monospace", fontSize: "11px" }}>{f.cuit_contraparte}</td>
            <td style={{ fontSize: "12px" }}>{f.razon_social}</td>
            <td style={{ textAlign: "right", fontWeight: "600", fontSize: "12px" }}>{formatCurrency(f.importe_total)}</td>
            <td>
              <span style={{ background: "#f0f2f5", color: "#6b7280", padding: "2px 7px", borderRadius: "10px", fontSize: "10px", fontWeight: "600", textTransform: "uppercase" }}>
                {f.estado}
              </span>
            </td>
            <td>
              <span style={{ background: "#f9ece7", color: "#993C1D", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>
                VERIFICAR
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ mensaje, icono }: { mensaje: string; icono?: string }) {
  return (
    <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af", fontSize: "13px" }}>
      <div style={{ fontSize: "24px", marginBottom: "8px" }}>{icono || "📋"}</div>
      {mensaje}
    </div>
  );
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

function SummaryCard({
  label, count, total, color, bg, icon, onClick, active,
}: {
  label: string; count: number; total: number;
  color: string; bg: string; icon: React.ReactNode;
  onClick: () => void; active: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "16px 20px",
        border: active ? `1.5px solid ${color}` : "0.5px solid rgba(0,0,0,0.10)",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        fontFamily: "inherit",
        transition: "border-color 0.15s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
        <div style={{ background: bg, color, borderRadius: "8px", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {icon}
        </div>
        <div style={{ fontSize: "12px", fontWeight: "500", color: "#6b7280" }}>{label}</div>
      </div>
      <div style={{ fontSize: "28px", fontWeight: "700", color, lineHeight: 1.1 }}>{count}</div>
      <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
        {formatCurrency(total)}
      </div>
    </button>
  );
}

// ─── Estilos inline reutilizables ────────────────────────────────────────────

const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtnStyle: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "7px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtnStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnStyle: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
