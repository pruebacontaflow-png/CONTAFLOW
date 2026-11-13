"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function PeriodosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [periodos, setPeriodos] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [accionId, setAccionId] = useState<number | null>(null);
  const [resultado, setResultado] = useState<Record<number, { ok?: boolean; error?: string; debe?: number; haber?: number }>>({});

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch("/api/periodos");
    if (res.ok) setPeriodos(await res.json());
    setLoading(false);
  };
  useEffect(() => { if (status === "authenticated") fetchData(); }, [status]);

  const handleAccion = async (id: number, accion: "cerrar" | "reabrir") => {
    const msg = accion === "cerrar"
      ? "¿Cerrar este período? No se podrán agregar asientos luego del cierre."
      : "¿Reabrir este período?";
    if (!confirm(msg)) return;
    setAccionId(id);
    setResultado(prev => ({ ...prev, [id]: {} }));
    const res = await fetch(`/api/periodos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion }),
    });
    const data = await res.json();
    if (res.ok) {
      setResultado(prev => ({ ...prev, [id]: { ok: true } }));
      fetchData();
    } else {
      setResultado(prev => ({ ...prev, [id]: { error: data.error, debe: data.debe, haber: data.haber } }));
    }
    setAccionId(null);
  };

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Períodos contables</h1>
        <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
          El cierre de período requiere que el total Debe = Haber. Los períodos cerrados no aceptan nuevos asientos.
        </p>
      </div>

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Período</th>
                <th style={{ textAlign: "center" }}>Asientos</th>
                <th style={{ textAlign: "right" }}>Total Debe</th>
                <th style={{ textAlign: "right" }}>Total Haber</th>
                <th style={{ textAlign: "center" }}>Estado</th>
                <th>Cerrado por</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {periodos.map((p: any) => {
                const res = resultado[p.id];
                const cerrado = p.estado === "cerrado";
                return (
                  <>
                    <tr key={p.id}>
                      <td style={{ fontWeight: "600" }}>
                        {MESES[p.mes - 1]} {p.anio}
                      </td>
                      <td style={{ textAlign: "center", fontFamily: "monospace" }}>{p.cantidad_asientos ?? 0}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                        {p.total_debe > 0 ? formatCurrency(p.total_debe) : "—"}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                        {p.total_haber > 0 ? formatCurrency(p.total_haber) : "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          background: cerrado ? "#f0f2f5" : "#e6f4f0",
                          color: cerrado ? "#6b7280" : "#0F6E56",
                          padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "600",
                          display: "inline-flex", alignItems: "center", gap: "5px"
                        }}>
                          {cerrado ? <Lock size={10} /> : <Unlock size={10} />}
                          {cerrado ? "Cerrado" : "Abierto"}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", color: "#6b7280" }}>
                        {p.cerrado_por ? (
                          <span>{p.cerrado_por}<br /><span style={{ fontSize: "11px", color: "#9ca3af" }}>{p.fecha_cierre?.slice(0,10)}</span></span>
                        ) : "—"}
                      </td>
                      <td>
                        {role === "admin" && (
                          <button
                            onClick={() => handleAccion(p.id, cerrado ? "reabrir" : "cerrar")}
                            disabled={accionId === p.id}
                            style={{
                              display: "flex", alignItems: "center", gap: "6px",
                              background: cerrado ? "#e8f0fa" : "#f0f2f5",
                              color: cerrado ? "#185fa5" : "#374151",
                              border: "none", borderRadius: "8px", padding: "7px 14px",
                              fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit"
                            }}
                          >
                            {cerrado ? <><Unlock size={12} /> Reabrir</> : <><Lock size={12} /> Cerrar</>}
                          </button>
                        )}
                      </td>
                    </tr>
                    {res && (
                      <tr key={`msg-${p.id}`}>
                        <td colSpan={7} style={{ padding: "0 16px 10px 16px", background: "#fafbfc" }}>
                          {res.ok && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#0F6E56", fontSize: "13px" }}>
                              <CheckCircle size={14} /> Operación realizada correctamente.
                            </div>
                          )}
                          {res.error && (
                            <div style={{ background: "#f9ece7", border: "0.5px solid #993C1D", borderRadius: "8px", padding: "8px 12px", color: "#993C1D", fontSize: "12px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
                              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
                              <div>
                                <div style={{ fontWeight: "600" }}>{res.error}</div>
                                {res.debe !== undefined && (
                                  <div style={{ marginTop: "4px", fontFamily: "monospace" }}>
                                    Debe: {formatCurrency(res.debe)} / Haber: {formatCurrency(res.haber ?? 0)} / Diferencia: {formatCurrency(Math.abs((res.debe ?? 0) - (res.haber ?? 0)))}
                                  </div>
                                )}
                              </div>
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

      <div style={{ marginTop: "16px", fontSize: "12px", color: "#9ca3af", lineHeight: "1.6" }}>
        <strong>Nota:</strong> Para cerrar un período, la suma de todos los debe debe ser igual a la suma de todos los haber en ese período.
        Si encontrás una diferencia, revisá los asientos del período en la sección <em>Asientos contables</em>.
      </div>
    </div>
  );
}
