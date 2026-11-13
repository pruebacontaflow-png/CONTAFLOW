"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, X, ChevronDown, Building2, Hash } from "lucide-react";
import { formatDate } from "@/lib/utils";

const ESTADOS_INTERVALO: Record<string, { label: string; color: string; bg: string }> = {
  disponible: { label: "Disponible",  color: "#0F6E56", bg: "#e6f4f0" },
  parcial:    { label: "En uso",      color: "#854F0B", bg: "#fef3e2" },
  agotado:    { label: "Agotado",     color: "#993C1D", bg: "#f9ece7" },
};

function estadoIntervalo(desde: string, hasta: string, usados: number): string {
  const total = parseInt(hasta, 10) - parseInt(desde, 10) + 1;
  if (usados === 0) return "disponible";
  if (usados >= total) return "agotado";
  return "parcial";
}

export default function ChecquerasPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const [chequeras, setChequeras] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [intervalos, setIntervalos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingIntervalos, setLoadingIntervalos] = useState(false);

  const [showNewChequera, setShowNewChequera] = useState(false);
  const [showNewIntervalo, setShowNewIntervalo] = useState(false);

  const [formCh, setFormCh] = useState({ banco: "", id_cuenta: "", sociedad: "IT Click Video", nombre: "" });
  const [formInt, setFormInt] = useState({ numero_remesa: "1", numero_desde: "", numero_hasta: "", info_breve: "", fecha_compra: "", no_secuencial: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchChequeras = async () => {
    setLoading(true);
    const rows = await (await fetch("/api/chequeras")).json();
    setChequeras(rows);
    if (rows.length > 0 && !selected) {
      selectChequera(rows[0]);
    } else {
      setLoading(false);
    }
  };

  const selectChequera = async (ch: any) => {
    setSelected(ch);
    setLoadingIntervalos(true);
    setLoading(false);
    const rows = await (await fetch(`/api/chequeras/${ch.id}/intervalos`)).json();
    setIntervalos(rows);
    setLoadingIntervalos(false);
  };

  useEffect(() => { fetchChequeras(); }, []);

  const handleCreateChequera = async () => {
    setError("");
    if (!formCh.banco || !formCh.id_cuenta) { setError("Banco e ID de cuenta son obligatorios"); return; }
    setSaving(true);
    const res = await fetch("/api/chequeras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formCh),
    });
    if (res.ok) {
      setShowNewChequera(false);
      setFormCh({ banco: "", id_cuenta: "", sociedad: "IT Click Video", nombre: "" });
      await fetchChequeras();
    } else {
      const j = await res.json();
      setError(j.error || "Error al crear");
    }
    setSaving(false);
  };

  const handleCreateIntervalo = async () => {
    setError("");
    if (!formInt.numero_desde || !formInt.numero_hasta) { setError("N° cheque inicial y final son obligatorios"); return; }
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/chequeras/${selected.id}/intervalos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formInt,
        numero_remesa: parseInt(formInt.numero_remesa, 10) || 1,
        no_secuencial: formInt.no_secuencial ? 1 : 0,
      }),
    });
    if (res.ok) {
      setShowNewIntervalo(false);
      setFormInt({ numero_remesa: "1", numero_desde: "", numero_hasta: "", info_breve: "", fecha_compra: "", no_secuencial: false });
      const rows = await (await fetch(`/api/chequeras/${selected.id}/intervalos`)).json();
      setIntervalos(rows);
    } else {
      const j = await res.json();
      setError(j.error || "Error al crear intervalo");
    }
    setSaving(false);
  };

  const totalCheques = (ci: any) =>
    parseInt(ci.numero_hasta, 10) - parseInt(ci.numero_desde, 10) + 1;

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Chequeras</div>
        {isAdmin && (
          <button className="btn-primary" onClick={() => { setError(""); setShowNewChequera(true); }} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={14} /> Nueva chequera
          </button>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Panel izquierdo — selector */}
        <div style={{ width: "240px", borderRight: "0.5px solid rgba(0,0,0,0.10)", overflowY: "auto", background: "#f9fafb", flexShrink: 0 }}>
          {loading ? (
            <div style={{ padding: "24px", color: "#6b7280", fontSize: "13px" }}>Cargando...</div>
          ) : chequeras.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center" }}>
              <Building2 size={32} color="#e5e7eb" style={{ margin: "0 auto 10px" }} />
              <div style={{ fontSize: "13px", color: "#9ca3af" }}>Sin chequeras</div>
            </div>
          ) : (
            <div style={{ padding: "12px 8px" }}>
              {chequeras.map(ch => (
                <div
                  key={ch.id}
                  onClick={() => selectChequera(ch)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginBottom: "4px",
                    background: selected?.id === ch.id ? "rgba(24,95,165,0.1)" : "transparent",
                    border: selected?.id === ch.id ? "1px solid rgba(24,95,165,0.3)" : "1px solid transparent",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>{ch.banco}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280", fontFamily: "monospace", marginTop: "2px" }}>
                    Cta: {ch.id_cuenta}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>
                    {ch.cant_intervalos || 0} intervalo{ch.cant_intervalos !== 1 ? "s" : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel derecho — detalle */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px" }}>
          {!selected ? (
            <div style={{ textAlign: "center", padding: "80px", color: "#9ca3af" }}>
              <Building2 size={48} color="#e5e7eb" style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: "15px", fontWeight: "500" }}>Seleccioná una chequera</div>
              <div style={{ fontSize: "13px", marginTop: "6px" }}>o creá una nueva usando el botón superior</div>
            </div>
          ) : (
            <>
              {/* Header SAP-style */}
              <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", padding: "20px 24px", marginBottom: "20px" }}>
                <div style={{ fontSize: "15px", fontWeight: "700", color: "#111827", marginBottom: "16px" }}>
                  Actualizar intervalos de N° de cheque
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr auto 1fr", gap: "8px 20px", alignItems: "center", fontSize: "13px" }}>
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>Sociedad pagadora</span>
                  <span style={{ fontWeight: "700", background: "#fef3e2", padding: "3px 10px", borderRadius: "5px", fontFamily: "monospace" }}>
                    {selected.sociedad || "IT Click Video"}
                  </span>
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>Banco propio</span>
                  <span style={{ fontWeight: "700", background: "#fef3e2", padding: "3px 10px", borderRadius: "5px", fontFamily: "monospace" }}>
                    {selected.banco}
                  </span>
                  <span style={{ color: "#6b7280", fontWeight: "500" }}>ID de cuenta</span>
                  <span style={{ fontWeight: "700", background: "#fef3e2", padding: "3px 10px", borderRadius: "5px", fontFamily: "monospace" }}>
                    {selected.id_cuenta}
                  </span>
                </div>
              </div>

              {/* Tabla intervalos */}
              <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
                <div style={{ padding: "14px 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: "13px", fontWeight: "700" }}>Intervalos núm. cheque</div>
                  {isAdmin && (
                    <button
                      onClick={() => { setError(""); setShowNewIntervalo(true); }}
                      style={{ display: "flex", alignItems: "center", gap: "5px", background: "#f0f2f5", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: "7px", padding: "5px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#374151", fontFamily: "inherit" }}
                    >
                      <Plus size={12} /> Crear intervalo
                    </button>
                  )}
                </div>

                {loadingIntervalos ? (
                  <div style={{ padding: "32px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>Cargando intervalos...</div>
                ) : intervalos.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center" }}>
                    <Hash size={36} color="#e5e7eb" style={{ margin: "0 auto 10px" }} />
                    <div style={{ fontSize: "14px", color: "#9ca3af" }}>Sin intervalos configurados</div>
                    {isAdmin && (
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
                        Usá "Crear intervalo" para agregar el primer rango de números
                      </div>
                    )}
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>N° Remesa</th>
                        <th>N° Cheque desde</th>
                        <th>N° Cheque hasta</th>
                        <th style={{ textAlign: "center" }}>Total</th>
                        <th style={{ textAlign: "center" }}>Usados</th>
                        <th>Info breve</th>
                        <th>Fecha compra</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intervalos.map(ci => {
                        const usados = ci.cheques_usados as number || 0;
                        const total = totalCheques(ci);
                        const est = estadoIntervalo(ci.numero_desde, ci.numero_hasta, usados);
                        const estInfo = ESTADOS_INTERVALO[est];
                        return (
                          <tr key={ci.id}>
                            <td style={{ fontFamily: "monospace", fontWeight: "700", textAlign: "center" }}>{ci.numero_remesa}</td>
                            <td style={{ fontFamily: "monospace", fontWeight: "600", color: "#185fa5" }}>{ci.numero_desde}</td>
                            <td style={{ fontFamily: "monospace", fontWeight: "600", color: "#185fa5" }}>{ci.numero_hasta}</td>
                            <td style={{ textAlign: "center", color: "#6b7280" }}>{total}</td>
                            <td style={{ textAlign: "center" }}>
                              <span style={{ fontWeight: usados > 0 ? "700" : "400", color: usados > 0 ? "#993C1D" : "#9ca3af" }}>
                                {usados}
                              </span>
                            </td>
                            <td style={{ color: "#6b7280", fontSize: "12px" }}>{ci.info_breve || "—"}</td>
                            <td style={{ fontSize: "12px", color: "#6b7280" }}>{ci.fecha_compra ? formatDate(ci.fecha_compra) : "—"}</td>
                            <td>
                              <span style={{ background: estInfo.bg, color: estInfo.color, fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "10px" }}>
                                {estInfo.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nueva chequera */}
      {showNewChequera && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowNewChequera(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "420px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>Nueva chequera</div>
              <button onClick={() => setShowNewChequera(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={lbl}>Banco *</label>
                <input className="form-input" value={formCh.banco} onChange={e => setFormCh(f => ({ ...f, banco: e.target.value }))} placeholder="Ej: Banco Credicoop" />
              </div>
              <div>
                <label style={lbl}>ID de cuenta *</label>
                <input className="form-input" value={formCh.id_cuenta} onChange={e => setFormCh(f => ({ ...f, id_cuenta: e.target.value }))} placeholder="Ej: 37405" />
              </div>
              <div>
                <label style={lbl}>Sociedad pagadora</label>
                <input className="form-input" value={formCh.sociedad} onChange={e => setFormCh(f => ({ ...f, sociedad: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Nombre (opcional)</label>
                <input className="form-input" value={formCh.nombre} onChange={e => setFormCh(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre descriptivo" />
              </div>
            </div>
            {error && <div style={{ color: "#993C1D", fontSize: "12px", marginTop: "12px", background: "#f9ece7", padding: "8px 12px", borderRadius: "7px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button className="btn-secondary" onClick={() => setShowNewChequera(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateChequera} disabled={saving}>{saving ? "Guardando..." : "Crear"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nuevo intervalo */}
      {showNewIntervalo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowNewIntervalo(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "480px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>Crear intervalo</div>
              <button onClick={() => setShowNewIntervalo(false)} style={iconBtn}><X size={18} /></button>
            </div>

            {/* Secuencia section */}
            <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "14px 16px", marginBottom: "14px", border: "0.5px solid #e5e7eb" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Secuencia</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={lbl}>N° Remesa</label>
                  <input className="form-input" type="number" value={formInt.numero_remesa} onChange={e => setFormInt(f => ({ ...f, numero_remesa: e.target.value }))} />
                </div>
                <div />
                <div>
                  <label style={lbl}>N° Cheque inicial *</label>
                  <input className="form-input" value={formInt.numero_desde} onChange={e => setFormInt(f => ({ ...f, numero_desde: e.target.value }))} placeholder="0000000001" style={{ fontFamily: "monospace" }} />
                </div>
                <div>
                  <label style={lbl}>Hasta *</label>
                  <input className="form-input" value={formInt.numero_hasta} onChange={e => setFormInt(f => ({ ...f, numero_hasta: e.target.value }))} placeholder="0000000100" style={{ fontFamily: "monospace" }} />
                </div>
              </div>
            </div>

            {/* Control section */}
            <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "14px 16px", marginBottom: "14px", border: "0.5px solid #e5e7eb" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Control</div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "#374151" }}>
                <input type="checkbox" checked={formInt.no_secuencial} onChange={e => setFormInt(f => ({ ...f, no_secuencial: e.target.checked }))} />
                No secuencial
              </label>
            </div>

            {/* Información adicional */}
            <div style={{ background: "#f9fafb", borderRadius: "8px", padding: "14px 16px", border: "0.5px solid #e5e7eb" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Información adicional</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ gridColumn: "span 2" }}>
                  <label style={lbl}>Info breve</label>
                  <input className="form-input" value={formInt.info_breve} onChange={e => setFormInt(f => ({ ...f, info_breve: e.target.value }))} placeholder="Ej: REMESA DE CHEQUE CREDICOOP" />
                </div>
                <div>
                  <label style={lbl}>Fecha compra</label>
                  <input className="form-input" type="date" value={formInt.fecha_compra} onChange={e => setFormInt(f => ({ ...f, fecha_compra: e.target.value }))} />
                </div>
              </div>
            </div>

            {error && <div style={{ color: "#993C1D", fontSize: "12px", marginTop: "12px", background: "#f9ece7", padding: "8px 12px", borderRadius: "7px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button className="btn-secondary" onClick={() => setShowNewIntervalo(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleCreateIntervalo} disabled={saving}>{saving ? "Guardando..." : "Crear intervalo"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "4px" };
const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" };
