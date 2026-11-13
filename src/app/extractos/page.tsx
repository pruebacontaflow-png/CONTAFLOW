"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Upload, Trash2, ChevronRight, AlertTriangle, Loader2, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export default function ExtractosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [extractos, setExtractos] = useState<any[]>([]);
  const [cuentas, setCuentas]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Formulario
  const [cuentaId, setCuentaId]       = useState("");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [saldoFinal, setSaldoFinal]   = useState("");
  const [observaciones, setObs]       = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = async () => {
    setLoading(true);
    const [e, c] = await Promise.all([
      fetch("/api/extractos").then(r => r.ok ? r.json() : []),
      fetch("/api/bancos").then(r => r.ok ? r.json() : { cuentas: [] }),
    ]);
    setExtractos(e);
    setCuentas(c.cuentas ?? []);
    setLoading(false);
  };
  useEffect(() => { if (status === "authenticated") fetchData(); }, [status]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Seleccioná un archivo"); return; }
    if (!cuentaId) { setError("Seleccioná una cuenta bancaria"); return; }
    setUploading(true); setError("");
    const fd = new FormData();
    fd.append("archivo", file);
    fd.append("cuenta_bancaria_id", cuentaId);
    fd.append("saldo_inicial", saldoInicial);
    fd.append("saldo_final", saldoFinal);
    fd.append("observaciones", observaciones);
    const res = await fetch("/api/extractos", { method: "POST", body: fd });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Error al importar");
    } else {
      const d = await res.json();
      setShowForm(false);
      router.push(`/extractos/${d.id}`);
    }
    setUploading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este extracto y todas sus líneas?")) return;
    await fetch(`/api/extractos/${id}`, { method: "DELETE" });
    fetchData();
  };

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Extractos bancarios</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Importá extractos CSV/Excel y conciliá movimientos con órdenes de pago y cobros</p>
        </div>
        {["admin","contador"].includes(role) && (
          <button onClick={() => { setError(""); setShowForm(true); }} style={primaryBtnSt}>
            <Upload size={15} /> Importar extracto
          </button>
        )}
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : extractos.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <FileText size={40} style={{ color: "#d1d5db", marginBottom: "12px" }} />
            <div style={{ fontSize: "15px", fontWeight: "600", color: "#6b7280" }}>Sin extractos importados</div>
            <div style={{ fontSize: "13px", color: "#9ca3af", marginTop: "6px" }}>Importá el primer extracto bancario para comenzar la conciliación</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Banco / Cuenta</th>
                <th>Período</th>
                <th style={{ textAlign: "right" }}>Saldo inicial</th>
                <th style={{ textAlign: "right" }}>Saldo final</th>
                <th style={{ textAlign: "right" }}>Débitos</th>
                <th style={{ textAlign: "right" }}>Créditos</th>
                <th style={{ textAlign: "center" }}>Conciliación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {extractos.map((e: any) => {
                const pct = e.total_lineas > 0 ? Math.round((e.lineas_conciliadas / e.total_lineas) * 100) : 0;
                return (
                  <tr key={e.id}>
                    <td>
                      <div style={{ fontWeight: "600" }}>{e.banco}</div>
                      <div style={{ fontSize: "11px", color: "#9ca3af" }}>{e.tipo_cuenta} · {e.moneda}</div>
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {formatDate(e.fecha_desde)} – {formatDate(e.fecha_hasta)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatCurrency(e.saldo_inicial)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatCurrency(e.saldo_final)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "#993C1D" }}>{formatCurrency(e.total_debitos)}</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "#0F6E56" }}>{formatCurrency(e.total_creditos)}</td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                        <div style={{ width: "80px", height: "6px", background: "#f0f2f5", borderRadius: "3px", overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#0F6E56" : "#185fa5", borderRadius: "3px" }} />
                        </div>
                        <span style={{ fontSize: "11px", color: "#6b7280" }}>{e.lineas_conciliadas}/{e.total_lineas}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <Link href={`/extractos/${e.id}`} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#e8f0fa", color: "#185fa5", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", textDecoration: "none" }}>
                          Ver <ChevronRight size={12} />
                        </Link>
                        {role === "admin" && (
                          <button onClick={() => handleDelete(e.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "4px" }}><Trash2 size={13} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal importar */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "500px" }}>
            <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px" }}>Importar extracto bancario</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelSt}>Cuenta bancaria *</label>
                <select value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
                  <option value="">— Seleccioná —</option>
                  {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco} – {c.tipo} ({c.moneda})</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Archivo CSV o XLSX *</label>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ fontSize: "13px", padding: "6px", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", width: "100%", boxSizing: "border-box" }} />
                <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>
                  Columnas esperadas: fecha, descripcion/concepto, debito/credito (o importe con signo), saldo (opcional)
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelSt}>Saldo inicial</label>
                  <input type="number" value={saldoInicial} onChange={e => setSaldoInicial(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label style={labelSt}>Saldo final</label>
                  <input type="number" value={saldoFinal} onChange={e => setSaldoFinal(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label style={labelSt}>Observaciones</label>
                <input value={observaciones} onChange={e => setObs(e.target.value)} placeholder="Ej: Extracto octubre 2026" />
              </div>
            </div>

            {error && (
              <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "9px 14px", color: "#993C1D", fontSize: "13px", marginTop: "14px", display: "flex", gap: "8px" }}>
                <AlertTriangle size={15} />{error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handleUpload} disabled={uploading} style={primaryBtnSt}>
                {uploading ? <Loader2 size={14} /> : <Upload size={14} />} Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const primaryBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSt: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
