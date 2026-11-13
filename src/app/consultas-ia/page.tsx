"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Play, Database, ChevronDown, AlertCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPO_ICONS: Record<string, string> = {
  tabla:    "📊",
  resumen:  "📋",
  lista:    "📝",
};

function formatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") {
    if (Math.abs(val) > 100) return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    return String(val);
  }
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDate(val);
    return val;
  }
  return String(val);
}

export default function ConsultasIAPage() {
  const { data: session } = useSession();
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, { rows: any[]; error?: string }>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setConsultas(await (await fetch("/api/consultas-ia")).json());
      setLoading(false);
    })();
  }, []);

  const runConsulta = async (id: number) => {
    setRunning(id);
    setResults(r => ({ ...r, [id]: { rows: [] } }));
    const res = await fetch("/api/consultas-ia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consulta_id: id }) });
    const data = await res.json();
    if (!res.ok) {
      setResults(r => ({ ...r, [id]: { rows: [], error: data.error || "Error al ejecutar" } }));
    } else {
      setResults(r => ({ ...r, [id]: { rows: data.rows || [] } }));
    }
    setRunning(null);
  };

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        <Database size={16} color="#185fa5" />
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Consultas de análisis</div>
        <div style={{ fontSize: "13px", color: "#9ca3af" }}>Informes predefinidos · solo lectura</div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        {loading ? <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>Cargando...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {consultas.map(c => {
              const res = results[c.id];
              const isRunning = running === c.id;
              const cols = res?.rows?.length ? Object.keys(res.rows[0]) : [];

              return (
                <div key={c.id} style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
                  <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontSize: "16px" }}>{TIPO_ICONS[c.tipo_resultado] || "📊"}</span>
                        <div style={{ fontSize: "14px", fontWeight: "600" }}>{c.titulo}</div>
                      </div>
                      {c.descripcion && <div style={{ fontSize: "13px", color: "#6b7280" }}>{c.descripcion}</div>}
                    </div>
                    <button
                      onClick={() => runConsulta(c.id)}
                      disabled={isRunning}
                      style={{ display: "flex", alignItems: "center", gap: "7px", background: isRunning ? "#f3f4f6" : "#185fa5", color: isRunning ? "#9ca3af" : "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: isRunning ? "not-allowed" : "pointer", flexShrink: 0, fontFamily: "inherit" }}
                    >
                      <Play size={13} />
                      {isRunning ? "Ejecutando..." : "Ejecutar"}
                    </button>
                  </div>

                  {res && (
                    <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)" }}>
                      {res.error ? (
                        <div style={{ padding: "14px 20px", display: "flex", gap: "8px", alignItems: "center", color: "#993C1D", fontSize: "13px", background: "#fef2f2" }}>
                          <AlertCircle size={14} />
                          {res.error}
                        </div>
                      ) : res.rows.length === 0 ? (
                        <div style={{ padding: "14px 20px", color: "#9ca3af", fontSize: "13px" }}>Sin resultados</div>
                      ) : (
                        <div style={{ overflowX: "auto" }}>
                          <table className="data-table" style={{ margin: 0, borderRadius: 0 }}>
                            <thead>
                              <tr>
                                {cols.map(col => (
                                  <th key={col} style={{ whiteSpace: "nowrap" }}>
                                    {col.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {res.rows.slice(0, 100).map((row, i) => (
                                <tr key={i}>
                                  {cols.map(col => (
                                    <td key={col} style={{ whiteSpace: "nowrap" }}>
                                      {formatValue(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {res.rows.length > 100 && (
                            <div style={{ padding: "10px 20px", fontSize: "12px", color: "#9ca3af", borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                              Mostrando 100 de {res.rows.length} resultados
                            </div>
                          )}
                          <div style={{ padding: "8px 20px", fontSize: "12px", color: "#9ca3af", background: "#f9fafb", borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                            {res.rows.length} {res.rows.length === 1 ? "fila" : "filas"}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
