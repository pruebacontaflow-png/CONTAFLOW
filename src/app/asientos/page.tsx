"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, AlertTriangle, ChevronDown, ChevronRight, Loader2, Trash2, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const emptyLinea = { cuenta_id: "", debe: "", haber: "", descripcion: "" };

export default function AsientosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const hoy = new Date();
  const [anio, setAnio]     = useState(String(hoy.getFullYear()));
  const [mes, setMes]       = useState(String(hoy.getMonth() + 1).padStart(2, "0"));
  const [asientos, setAsientos] = useState<any[]>([]);
  const [cuentas, setCuentas]   = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [detalles, setDetalles] = useState<Record<number, any>>({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  // Formulario nuevo asiento
  const [fecha, setFecha]       = useState(hoy.toISOString().slice(0,10));
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas]     = useState([{ ...emptyLinea }, { ...emptyLinea }]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchAsientos = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/asientos?anio=${anio}&mes=${mes}`);
    if (res.ok) setAsientos(await res.json());
    setLoading(false);
  }, [anio, mes]);

  const fetchCuentas = async () => {
    const res = await fetch("/api/plan-cuentas");
    if (res.ok) setCuentas(await res.json());
  };

  useEffect(() => { if (status === "authenticated") { fetchAsientos(); fetchCuentas(); } }, [status, fetchAsientos]);

  const toggle = async (id: number) => {
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    if (!detalles[id]) {
      const res = await fetch(`/api/asientos/${id}`);
      if (res.ok) { const d = await res.json(); setDetalles(prev => ({ ...prev, [id]: d })); }
    }
  };

  const addLinea = () => setLineas(l => [...l, { ...emptyLinea }]);
  const removeLinea = (i: number) => setLineas(l => l.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: string, val: string) => {
    setLineas(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln));
  };

  const sumaDebe  = lineas.reduce((s, l) => s + (parseFloat(l.debe  || "0") || 0), 0);
  const sumaHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber || "0") || 0), 0);
  const balanceado = Math.abs(sumaDebe - sumaHaber) <= 0.01;

  const handleSave = async () => {
    if (!descripcion.trim()) { setError("Ingresá la descripción del asiento"); return; }
    if (lineas.some(l => !l.cuenta_id)) { setError("Cada línea debe tener cuenta asignada"); return; }
    if (!balanceado) { setError(`El asiento no balancea. Debe: ${formatCurrency(sumaDebe)} / Haber: ${formatCurrency(sumaHaber)}`); return; }
    setSaving(true); setError("");
    const body = { fecha, descripcion, lineas: lineas.map(l => ({ cuenta_id: Number(l.cuenta_id), debe: parseFloat(l.debe || "0") || 0, haber: parseFloat(l.haber || "0") || 0, descripcion: l.descripcion })) };
    const res = await fetch("/api/asientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const d = await res.json(); setError(d.error || "Error al guardar"); }
    else { setShowForm(false); setLineas([{ ...emptyLinea }, { ...emptyLinea }]); setDescripcion(""); fetchAsientos(); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este asiento manual?")) return;
    const res = await fetch(`/api/asientos/${id}`, { method: "DELETE" });
    if (res.ok) fetchAsientos();
    else { const d = await res.json(); alert(d.error || "No se pudo eliminar"); }
  };

  const cuentasImputables = cuentas.filter(c => c.imputable && c.activo);

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Asientos contables</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Partida doble · los automáticos se generan al aprobar facturas y registrar pagos</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {["admin","contador"].includes(role) && (
            <>
              <a
                href={`/api/asientos/exportar?tipo=diario&anio=${anio}&mes=${mes}`}
                download
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "#e6f4f0", color: "#0F6E56", border: "none", borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", textDecoration: "none" }}
              >
                <Download size={14} /> Libro Diario
              </a>
              <a
                href={`/api/asientos/exportar?tipo=mayor&anio=${anio}`}
                download
                style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f0f6ff", color: "#185fa5", border: "none", borderRadius: "8px", padding: "9px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", textDecoration: "none" }}
              >
                <Download size={14} /> Libro Mayor
              </a>
              <button onClick={() => { setError(""); setShowForm(true); }} style={primaryBtnSt}>
                <Plus size={15} /> Asiento manual
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <select value={anio} onChange={e => setAnio(e.target.value)} style={selectSt}>
          {[hoy.getFullYear()-1, hoy.getFullYear(), hoy.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(e.target.value)} style={selectSt}>
          {MESES.map((m, i) => <option key={i+1} value={String(i+1).padStart(2,"0")}>{m}</option>)}
        </select>
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : asientos.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>Sin asientos en {MESES[parseInt(mes)-1]} {anio}</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: "24px" }}></th>
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: "right" }}>Debe</th>
                  <th style={{ textAlign: "right" }}>Haber</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {asientos.map((a: any) => {
                  const exp = expanded.has(a.id);
                  const det = detalles[a.id];
                  return (
                    <>
                      <tr key={a.id} onClick={() => toggle(a.id)} style={{ cursor: "pointer" }}>
                        <td style={{ color: "#9ca3af" }}>{exp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#9ca3af" }}>#{a.id}</td>
                        <td>{formatDate(a.fecha)}</td>
                        <td style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.descripcion}</td>
                        <td>
                          <span style={{ background: a.tipo === "manual" ? "#fef3e2" : "#e8f0fa", color: a.tipo === "manual" ? "#854F0B" : "#185fa5", padding: "1px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: "600" }}>
                            {a.tipo}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatCurrency(a.total_debe)}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatCurrency(a.total_haber)}</td>
                        <td onClick={e => e.stopPropagation()}>
                          {a.tipo === "manual" && ["admin","contador"].includes(role) && (
                            <button onClick={() => handleDelete(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "2px 6px" }}><Trash2 size={13} /></button>
                          )}
                        </td>
                      </tr>
                      {exp && det && (
                        <tr key={`det-${a.id}`}>
                          <td colSpan={8} style={{ padding: "0 16px 12px 48px", background: "#fafbfc" }}>
                            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ color: "#9ca3af" }}>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: "500" }}>Código</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: "500" }}>Cuenta</th>
                                  <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: "500" }}>Descripción</th>
                                  <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: "500" }}>Debe</th>
                                  <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: "500" }}>Haber</th>
                                </tr>
                              </thead>
                              <tbody>
                                {det.lineas?.map((l: any, i: number) => (
                                  <tr key={i} style={{ borderTop: "0.5px solid #f0f2f5" }}>
                                    <td style={{ padding: "4px 8px", fontFamily: "monospace", color: "#9ca3af", fontSize: "11px" }}>{l.codigo}</td>
                                    <td style={{ padding: "4px 8px" }}>{l.cuenta_nombre}</td>
                                    <td style={{ padding: "4px 8px", color: "#6b7280" }}>{l.descripcion || "—"}</td>
                                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace" }}>{l.debe > 0 ? formatCurrency(l.debe) : "—"}</td>
                                    <td style={{ padding: "4px 8px", textAlign: "right", fontFamily: "monospace" }}>{l.haber > 0 ? formatCurrency(l.haber) : "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Modal nuevo asiento */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "60px" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "700px", maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>Nuevo asiento manual</div>
              <button onClick={() => setShowForm(false)} style={iconBtnSt}><X size={18} /></button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px", marginBottom: "20px" }}>
              <div>
                <label style={labelSt}>Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Descripción *</label>
                <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Registro factura Prov. X" />
              </div>
            </div>

            <div style={{ marginBottom: "12px", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Líneas</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", marginBottom: "10px" }}>
              <thead>
                <tr style={{ background: "#f7f8fa" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "500" }}>Cuenta</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "500", width: "110px" }}>Debe</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "500", width: "110px" }}>Haber</th>
                  <th style={{ padding: "6px 8px", width: "140px", fontWeight: "500" }}>Descripción</th>
                  <th style={{ width: "28px" }}></th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i} style={{ borderBottom: "0.5px solid #f0f2f5" }}>
                    <td style={{ padding: "4px 4px" }}>
                      <select value={l.cuenta_id} onChange={e => updateLinea(i, "cuenta_id", e.target.value)} style={{ fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "0.5px solid rgba(0,0,0,0.15)", width: "100%", fontFamily: "inherit" }}>
                        <option value="">— Seleccioná —</option>
                        {cuentasImputables.map(c => <option key={c.id} value={c.id}>{c.codigo} – {c.nombre}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "4px 4px" }}>
                      <input type="number" value={l.debe} onChange={e => updateLinea(i, "debe", e.target.value)} placeholder="0.00" style={{ textAlign: "right", fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "0.5px solid rgba(0,0,0,0.15)", width: "100%", fontFamily: "monospace" }} />
                    </td>
                    <td style={{ padding: "4px 4px" }}>
                      <input type="number" value={l.haber} onChange={e => updateLinea(i, "haber", e.target.value)} placeholder="0.00" style={{ textAlign: "right", fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "0.5px solid rgba(0,0,0,0.15)", width: "100%", fontFamily: "monospace" }} />
                    </td>
                    <td style={{ padding: "4px 4px" }}>
                      <input value={l.descripcion} onChange={e => updateLinea(i, "descripcion", e.target.value)} placeholder="Opcional" style={{ fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "0.5px solid rgba(0,0,0,0.15)", width: "100%", fontFamily: "inherit" }} />
                    </td>
                    <td style={{ padding: "4px 4px" }}>
                      {lineas.length > 2 && (
                        <button onClick={() => removeLinea(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}><X size={13} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: "700", background: balanceado ? "#e6f4f0" : "#f9ece7", color: balanceado ? "#0F6E56" : "#993C1D" }}>
                  <td style={{ padding: "6px 8px" }}>TOTALES</td>
                  <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace" }}>{formatCurrency(sumaDebe)}</td>
                  <td style={{ textAlign: "right", padding: "6px 8px", fontFamily: "monospace" }}>{formatCurrency(sumaHaber)}</td>
                  <td colSpan={2} style={{ padding: "6px 8px", fontSize: "11px" }}>{balanceado ? "✓ Balancea" : `Diferencia: ${formatCurrency(Math.abs(sumaDebe - sumaHaber))}`}</td>
                </tr>
              </tfoot>
            </table>

            <button onClick={addLinea} style={{ fontSize: "12px", color: "#185fa5", background: "#e8f0fa", border: "none", borderRadius: "6px", padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", marginBottom: "16px" }}>
              + Agregar línea
            </button>

            {error && (
              <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "9px 14px", color: "#993C1D", fontSize: "13px", marginBottom: "14px", display: "flex", gap: "8px" }}>
                <AlertTriangle size={15} />{error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtnSt}>{saving ? <Loader2 size={14} /> : <Check size={14} />} Guardar asiento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtnSt: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSt: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
const selectSt: React.CSSProperties = { padding: "8px 12px", borderRadius: "8px", border: "0.5px solid rgba(0,0,0,0.15)", fontFamily: "inherit", fontSize: "13px" };
