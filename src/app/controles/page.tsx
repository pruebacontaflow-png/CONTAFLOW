"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AppLayout } from "@/components/AppLayout";
import { RefreshCw, CheckCircle2, XCircle, Circle } from "lucide-react";

interface Control {
  id: string;
  titulo: string;
  estado: "verde" | "rojo" | "gris";
  detalle: string;
  mes?: string;
}

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function ControlesPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const [controles, setControles] = useState<Control[]>([]);
  const [generado, setGenerado] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/controles");
      const data = await res.json();
      setControles(data.controles || []);
      setGenerado(data.generado || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const verdes = controles.filter(c => c.estado === "verde").length;
  const rojos = controles.filter(c => c.estado === "rojo").length;
  const grises = controles.filter(c => c.estado === "gris").length;

  return (
    <AppLayout>
      <div style={{ padding: "28px 32px", maxWidth: 860 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#111827" }}>Controles de cuadre</h1>
            {generado && (
              <div style={{ fontSize: "11px", color: "#6b7280", marginTop: 4 }}>
                Calculado el {fmtFecha(generado)}
              </div>
            )}
          </div>
          <button
            onClick={cargar}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#185fa5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: loading ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Recalcular
          </button>
        </div>

        {/* Resumen */}
        {controles.length > 0 && (
          <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
            {[
              { n: verdes, label: "verde", bg: "#f0fdf4", color: "#0F6E56", border: "#bbf7d0" },
              { n: rojos, label: "rojo", bg: "#fef2f2", color: "#993C1D", border: "#fecaca" },
              { n: grises, label: "sin datos", bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
            ].map(({ n, label, bg, color, border }) => (
              <div key={label} style={{ flex: 1, background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color }}>{n}</div>
                <div style={{ fontSize: 11, color, marginTop: 2 }}>{label === "verde" ? "✓ OK" : label === "rojo" ? "✗ Alertas" : "— Sin datos"}</div>
              </div>
            ))}
          </div>
        )}

        {/* Lista de controles */}
        {loading && controles.length === 0 ? (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "48px 0" }}>Calculando...</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {controles.map(c => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  background: c.estado === "verde" ? "#f0fdf4" : c.estado === "rojo" ? "#fef2f2" : "#f9fafb",
                  border: `1px solid ${c.estado === "verde" ? "#bbf7d0" : c.estado === "rojo" ? "#fecaca" : "#e5e7eb"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                }}
              >
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  {c.estado === "verde" && <CheckCircle2 size={18} color="#0F6E56" />}
                  {c.estado === "rojo" && <XCircle size={18} color="#993C1D" />}
                  {c.estado === "gris" && <Circle size={18} color="#9ca3af" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.estado === "verde" ? "#065f46" : c.estado === "rojo" ? "#7f1d1d" : "#374151" }}>
                    {c.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: c.estado === "verde" ? "#047857" : c.estado === "rojo" ? "#b91c1c" : "#6b7280", marginTop: 3 }}>
                    {c.detalle}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && controles.length === 0 && (
          <div style={{ textAlign: "center", color: "#6b7280", padding: "48px 0" }}>Sin controles cargados</div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </AppLayout>
  );
}
