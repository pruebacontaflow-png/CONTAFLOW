"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const NAV = "#0d1b2e";
const NAV2 = "#152338";
const NAV3 = "#1e3350";
const ACCENT = "#3b82f6";
const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const TEXT = "#e2e8f0";
const MUTED = "#64748b";

const MONTH_LABELS: Record<string, string> = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr", "05": "May", "06": "Jun",
  "07": "Jul", "08": "Ago", "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

function fmtM(mes: string) {
  const [, m] = (mes || "").split("-");
  return MONTH_LABELS[m] || mes;
}

function SemiGauge({ pct }: { pct: number }) {
  const r = 80;
  const cx = 110;
  const cy = 100;
  const angle = -180 + (pct / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const nx = cx + r * Math.cos(rad);
  const ny = cy + r * Math.sin(rad);
  const full = Math.PI * r;

  const steps = [
    { pct: 25, color: "#ef4444" },
    { pct: 25, color: "#f59e0b" },
    { pct: 25, color: "#3b82f6" },
    { pct: 25, color: "#22c55e" },
  ];

  let offset = 0;
  return (
    <svg viewBox="0 0 220 115" width="220" height="115">
      {steps.map((s, i) => {
        const dashLen = (s.pct / 100) * full;
        const dashOffset = -(offset / 100) * full;
        offset += s.pct;
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none" stroke={s.color} strokeWidth="14"
            strokeDasharray={`${dashLen} ${full}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-180, ${cx}, ${cy})`}
            strokeLinecap="butt"
          />
        );
      })}
      <line
        x1={cx} y1={cy}
        x2={nx} y2={ny}
        stroke="white" strokeWidth="2.5" strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="6" fill="white" />
      <text x={cx} y={cy + 22} textAnchor="middle" fill="white" fontSize="22" fontWeight="700">
        {pct.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 36} textAnchor="middle" fill={MUTED} fontSize="10">Beneficios/Facturación</text>
    </svg>
  );
}

export default function ComercialDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    setLoading(true);
    fetch(`/api/comercial/dashboard?anio=${anio}`)
      .then(r => r.ok ? r.json() : {})
      .then(d => { setData(d); setLoading(false); });
  }, [anio]);

  if (loading) {
    return (
      <AppLayout>
        <div style={{ flex: 1, background: NAV, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED }}>
          Cargando indicadores...
        </div>
      </AppLayout>
    );
  }

  const topClientes = (data?.topClientes ?? []).slice(0, 10);
  const topVendedores = (data?.topVendedores ?? []).slice(0, 8);
  const gauge = data?.gauge ?? { pct: 0, facturacion: 0, beneficios: 0, costos: 0 };
  const comisiones = (data?.comisionesResumen ?? {});
  const acuerdos = (data?.resumenAcuerdos ?? {});
  const comparativa = (data?.comparativaMes ?? {});
  const topAcuerdos = (data?.topAcuerdos ?? []);

  const maxVend = topVendedores.length > 0 ? topVendedores[0].total_comisiones : 1;
  const VENDEDORES_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#a78bfa", "#fb923c", "#34d399", "#f472b6", "#60a5fa"];

  return (
    <AppLayout>
      <div style={{ flex: 1, overflowY: "auto", background: NAV, minHeight: "100%" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "11px", letterSpacing: "2px", color: MUTED, textTransform: "uppercase" }}>Panel</div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", color: TEXT, margin: "2px 0 0", letterSpacing: "-0.5px" }}>INDICADORES</h1>
          </div>
          <select value={anio} onChange={e => setAnio(e.target.value)} style={{ background: NAV2, color: TEXT, border: `0.5px solid ${NAV3}`, borderRadius: "8px", padding: "6px 12px", fontSize: "13px" }}>
            {Array.from(new Set([String(new Date().getFullYear()), ...(data?.anios ?? [])])).sort().reverse().map((a: string) => <option key={a} value={a}>Año {a}</option>)}
          </select>
        </div>

        {/* KPI chips */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", padding: "16px 28px" }}>
          {[
            { label: "Facturación año", value: formatCurrency(gauge.facturacion), color: ACCENT },
            { label: "Costos año",      value: formatCurrency(gauge.costos),      color: "#f87171" },
            { label: "Beneficios",      value: formatCurrency(gauge.beneficios),  color: GREEN },
            { label: "Acuerdos activos",value: acuerdos.activos ?? 0,             color: AMBER },
          ].map((k, i) => (
            <div key={i} style={{ background: NAV2, borderRadius: "12px", padding: "14px 18px", border: `0.5px solid ${NAV3}` }}>
              <div style={{ fontSize: "11px", color: MUTED, marginBottom: "4px" }}>{k.label}</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Proyección vs real */}
        {(data?.proyeccion ?? []).length > 0 && (
          <div style={{ margin: "0 28px 12px", background: NAV2, borderRadius: "14px", padding: "18px", border: `0.5px solid ${NAV3}` }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: MUTED, textTransform: "uppercase", marginBottom: "10px" }}>Proyección vs real {anio} (planilla de comisiones)</div>
            <table style={{ width: "100%", fontSize: "12px", color: TEXT, borderCollapse: "collapse" }}>
              <thead><tr style={{ color: MUTED }}><th style={{ textAlign: "left", padding: "4px" }}>Mes</th><th style={{ textAlign: "right" }}>Proyectado</th><th style={{ textAlign: "right" }}>Real</th><th style={{ textAlign: "right" }}>Cumplimiento</th><th style={{ textAlign: "right" }}>Gastos comerciales</th></tr></thead>
              <tbody>
                {data.proyeccion.map((p: any) => {
                  const c = p.proyectado > 0 ? (p.real / p.proyectado) * 100 : 0;
                  return (
                    <tr key={p.mes} style={{ borderTop: `0.5px solid ${NAV3}` }}>
                      <td style={{ padding: "4px" }}>{MONTH_LABELS[p.mes.slice(5, 7)] ?? p.mes}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(p.proyectado)}</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(p.real)}</td>
                      <td style={{ textAlign: "right", color: c >= 96 ? GREEN : c >= 61 ? AMBER : "#f87171" }}>{c.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%</td>
                      <td style={{ textAlign: "right" }}>{formatCurrency(p.gastos)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Main grid: 3 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 240px", gap: "12px", padding: "0 28px 12px" }}>

          {/* TOP Clientes */}
          <div style={{ background: NAV2, borderRadius: "14px", padding: "18px", border: `0.5px solid ${NAV3}` }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: MUTED, textTransform: "uppercase", marginBottom: "2px" }}>TOP Clientes</div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: TEXT, marginBottom: "14px" }}>Facturación {anio}</div>
            {topClientes.length === 0 ? (
              <div style={{ fontSize: "12px", color: MUTED, padding: "20px 0" }}>Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topClientes} margin={{ top: 0, right: 4, bottom: 40, left: 0 }}>
                  <XAxis dataKey="nombre" tick={{ fontSize: 9, fill: MUTED }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 9, fill: MUTED }} tickFormatter={v => `${(v / 1e6).toFixed(1)}M`} />
                  <Tooltip
                    contentStyle={{ background: NAV3, border: "none", borderRadius: "8px", fontSize: "11px", color: TEXT }}
                    formatter={(v: any) => formatCurrency(v)}
                  />
                  <Bar dataKey="total_facturado" radius={[4, 4, 0, 0]}>
                    {topClientes.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? ACCENT : `${ACCENT}99`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* TOP Vendedores */}
          <div style={{ background: NAV2, borderRadius: "14px", padding: "18px", border: `0.5px solid ${NAV3}` }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: MUTED, textTransform: "uppercase", marginBottom: "2px" }}>TOP Vendedores</div>
            <div style={{ fontSize: "13px", fontWeight: "600", color: TEXT, marginBottom: "14px" }}>Comisiones {anio}</div>
            {topVendedores.length === 0 ? (
              <div style={{ fontSize: "12px", color: MUTED, padding: "20px 0" }}>Sin datos de comisiones</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {topVendedores.map((v: any, i: number) => {
                  const pct = maxVend > 0 ? (v.total_comisiones / maxVend) * 100 : 0;
                  const color = VENDEDORES_COLORS[i % VENDEDORES_COLORS.length];
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "12px", color: TEXT }}>{v.nombre}</span>
                        <span style={{ fontSize: "11px", color: MUTED }}>{formatCurrency(v.total_comisiones)}</span>
                      </div>
                      <div style={{ background: NAV3, borderRadius: "4px", height: "6px" }}>
                        <div style={{ width: `${pct}%`, height: "6px", borderRadius: "4px", background: color, transition: "width 0.6s" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Gauge */}
          <div style={{ background: NAV2, borderRadius: "14px", padding: "18px", border: `0.5px solid ${NAV3}`, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: MUTED, textTransform: "uppercase", marginBottom: "2px", alignSelf: "flex-start" }}>Beneficios VS Facturación</div>
            <div style={{ marginTop: "8px" }}>
              <SemiGauge pct={gauge.pct} />
            </div>
            <div style={{ marginTop: "8px", width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: MUTED }}>Facturación</span>
                <span style={{ color: TEXT, fontFamily: "monospace" }}>{formatCurrency(gauge.facturacion)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: MUTED }}>Costos</span>
                <span style={{ color: "#f87171", fontFamily: "monospace" }}>{formatCurrency(gauge.costos)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", borderTop: `0.5px solid ${NAV3}`, paddingTop: "6px" }}>
                <span style={{ color: GREEN, fontWeight: "600" }}>Beneficios</span>
                <span style={{ color: GREEN, fontFamily: "monospace", fontWeight: "700" }}>{formatCurrency(gauge.beneficios)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: Comisiones + TOP acuerdos */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", padding: "0 28px 28px" }}>

          {/* Comisiones vendedores tabla */}
          <div style={{ background: NAV2, borderRadius: "14px", padding: "18px", border: `0.5px solid ${NAV3}` }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: MUTED, textTransform: "uppercase", marginBottom: "12px" }}>Comisiones vendedores</div>
            {topVendedores.length === 0 ? (
              <div style={{ fontSize: "12px", color: MUTED }}>Sin datos</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${NAV3}` }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Vendedor</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Comisiones</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Acuerdos</th>
                  </tr>
                </thead>
                <tbody>
                  {topVendedores.map((v: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${NAV3}` }}>
                      <td style={{ padding: "7px 8px", color: TEXT }}>{v.nombre}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: GREEN, fontFamily: "monospace" }}>{formatCurrency(v.total_comisiones)}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: MUTED }}>{v.cant_comisiones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* TOP acuerdos */}
          <div style={{ background: NAV2, borderRadius: "14px", padding: "18px", border: `0.5px solid ${NAV3}` }}>
            <div style={{ fontSize: "11px", letterSpacing: "1.5px", color: MUTED, textTransform: "uppercase", marginBottom: "12px" }}>TOP Acuerdos activos</div>
            {topAcuerdos.length === 0 ? (
              <div style={{ fontSize: "12px", color: MUTED }}>Sin datos</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: `0.5px solid ${NAV3}` }}>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Acuerdo</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Cliente</th>
                    <th style={{ textAlign: "right", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Mensual</th>
                    <th style={{ textAlign: "left", padding: "6px 8px", color: MUTED, fontWeight: "600", fontSize: "10px" }}>Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {topAcuerdos.map((a: any, i: number) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${NAV3}` }}>
                      <td style={{ padding: "7px 8px", color: TEXT, maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.descripcion}</td>
                      <td style={{ padding: "7px 8px", color: MUTED, maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.cliente_nombre}</td>
                      <td style={{ padding: "7px 8px", textAlign: "right", color: AMBER, fontFamily: "monospace" }}>{formatCurrency(a.importe_mensual)}</td>
                      <td style={{ padding: "7px 8px", color: MUTED, fontSize: "11px" }}>{a.responsable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
