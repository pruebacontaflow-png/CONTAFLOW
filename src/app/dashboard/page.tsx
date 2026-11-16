"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  TrendingUp, Building2, ArrowUpCircle, ArrowDownCircle,
  Clock, ChevronDown, ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate, getDiasHastaVencimiento, getColorVencimiento } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;

const MES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_NUMS   = ['01','02','03','04','05','06','07','08','09','10','11','12'];

function mesToLabel(meses: string[]): string {
  if (meses.length === 12) return 'Año completo';
  if (meses.length === 1) return MES_LABELS[parseInt(meses[0]) - 1];
  const sorted = [...meses].sort();
  const first = MES_LABELS[parseInt(sorted[0]) - 1];
  const last  = MES_LABELS[parseInt(sorted[sorted.length - 1]) - 1];
  return meses.length === sorted.length && parseInt(sorted[sorted.length-1]) - parseInt(sorted[0]) === meses.length - 1
    ? `${first}–${last}` : `${meses.length} meses`;
}

export default function DashboardPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [meses, setMeses] = useState<string[]>([MES_NUMS[CURRENT_MONTH - 1]]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mesPickerOpen, setMesPickerOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const mesStr = meses.join(',');
      const res = await fetch(`/api/dashboard?year=${year}&meses=${mesStr}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [year, meses]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleMes = (m: string) => {
    setMeses(prev => prev.includes(m) ? (prev.length > 1 ? prev.filter(x => x !== m) : prev) : [...prev, m]);
  };

  const setAtajo = (tipo: 'vigente' | 'anterior' | 'anio') => {
    if (tipo === 'vigente')  setMeses([MES_NUMS[CURRENT_MONTH - 1]]);
    else if (tipo === 'anterior') {
      const prev = CURRENT_MONTH === 1 ? 12 : CURRENT_MONTH - 1;
      setMeses([MES_NUMS[prev - 1]]);
    } else setMeses([...MES_NUMS]);
    setMesPickerOpen(false);
  };

  const toggleGroup = (id: string) => setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }));

  const AÑOS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{
        background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)',
        padding: '0 28px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>Dashboard</div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Año */}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ width: '80px', padding: '5px 8px', fontSize: '13px', borderRadius: '7px', border: '1px solid #e5e7eb' }}
          >
            {AÑOS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Selector de meses */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMesPickerOpen(o => !o)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', fontSize: '13px', borderRadius: '7px',
                border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer',
                fontFamily: 'inherit', color: '#374151',
              }}
            >
              {mesToLabel(meses)} <ChevronDown size={13} />
            </button>

            {mesPickerOpen && (
              <div style={{
                position: 'absolute', top: '110%', right: 0, zIndex: 200,
                background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '12px 14px', minWidth: '240px',
              }}>
                {/* Atajos */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {[
                    { label: 'Mes vigente',  id: 'vigente'  },
                    { label: 'Mes anterior', id: 'anterior' },
                    { label: 'Año vigente',  id: 'anio'     },
                  ].map(a => (
                    <button key={a.id} onClick={() => setAtajo(a.id as any)} style={{
                      flex: 1, padding: '5px 4px', fontSize: '11px', fontWeight: '600',
                      borderRadius: '6px', border: '1px solid #185fa5', color: '#185fa5',
                      background: 'white', cursor: 'pointer', fontFamily: 'inherit',
                    }}>{a.label}</button>
                  ))}
                </div>
                {/* Grid de meses */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                  {MES_NUMS.map((m, i) => {
                    const sel = meses.includes(m);
                    return (
                      <button key={m} onClick={() => toggleMes(m)} style={{
                        padding: '5px', fontSize: '12px', fontWeight: sel ? 700 : 400,
                        borderRadius: '6px', cursor: 'pointer', fontFamily: 'inherit',
                        border: sel ? '2px solid #185fa5' : '1px solid #e5e7eb',
                        background: sel ? '#e8f0fa' : 'white', color: sel ? '#185fa5' : '#374151',
                      }}>{MES_LABELS[i]}</button>
                    );
                  })}
                </div>
                <button onClick={() => setMesPickerOpen(false)} style={{
                  marginTop: '10px', width: '100%', padding: '6px', fontSize: '12px',
                  borderRadius: '6px', border: '1px solid #e5e7eb', background: '#f9fafb',
                  cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280',
                }}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Cargando métricas...</div>
        ) : !data ? null : (
          <>
            {/* ── Tiles del período ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
              <MetricCard
                label="Ventas del período"
                value={formatCurrency(data.ventas)}
                sub="Neto sin IVA · NCs restan"
                icon={<TrendingUp size={18} />}
                color="#0F6E56" bg="#e6f4f0"
              />
              <MetricCard
                label="Ingresos por banco"
                value={formatCurrency(data.ingresoBanco)}
                sub="Créditos en extracto"
                icon={<ArrowUpCircle size={18} />}
                color="#185fa5" bg="#e8f0fa"
              />
              <MetricCard
                label="Egresos por banco"
                value={formatCurrency(data.egresoBanco)}
                sub="Débitos en extracto"
                icon={<ArrowDownCircle size={18} />}
                color="#993C1D" bg="#f9ece7"
              />
              <MetricCard
                label="Cobros por vencer (7d)"
                value={`${data.cobrosPorVencer7d.count} facturas`}
                sub={formatCurrency(data.cobrosPorVencer7d.total)}
                icon={<Clock size={18} />}
                color="#854F0B" bg="#fef3e2"
              />
              <MetricCard
                label="Saldo total bancario"
                value={formatCurrency(data.saldoTotal)}
                sub="Suma cuentas ARS"
                icon={<Building2 size={18} />}
                color="#185fa5" bg="#e8f0fa"
              />
            </div>

            {/* ── Saldos por banco e Inversiones ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'white', borderRadius: '12px', padding: '18px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Saldos por banco
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.saldosBancarios?.map((s: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', color: '#374151' }}>
                        {s.banco} <span style={{ color: '#9ca3af', fontSize: '11px' }}>({s.tipo})</span>
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: s.saldo_actual >= 0 ? '#0F6E56' : '#993C1D' }}>
                        {s.moneda === 'USD' ? `USD ${new Intl.NumberFormat('es-AR').format(s.saldo_actual)}` : formatCurrency(s.saldo_actual)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: 'white', borderRadius: '12px', padding: '18px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Inversiones activas
                </div>
                {!data.inversiones || data.inversiones.total === 0 ? (
                  <div style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Sin inversiones activas</div>
                ) : (
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    {data.inversiones.ars > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Total ARS</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#185fa5' }}>{formatCurrency(data.inversiones.ars)}</div>
                      </div>
                    )}
                    {data.inversiones.usd > 0 && (
                      <div>
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Total USD</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#0F6E56' }}>USD {data.inversiones.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>Instrumentos</div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: '#374151' }}>{data.inversiones.count}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Gráficos de flujo ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <FlujoBancoChart data={data.flujoMensualBanco || []} year={year} excluidas={data.cuentasExcluidasBanco || []} />
              <FlujoContableChart data={data.flujoMensualContable || []} year={year} />
            </div>

            {/* ── Aging CxP / CxC ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <AgingCard titulo="Antigüedad CxP (Pagar)" aging={data.agingCxP} />
              <AgingCard titulo="Antigüedad CxC (Cobrar)" aging={data.agingCxC} />
            </div>

            {/* ── Próximos vencimientos agrupados ── */}
            <VencimientosGrupados grupos={data.vencimientosGrupados || []} openGroups={openGroups} onToggle={toggleGroup} />
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, icon, color, bg }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string; bg: string;
}) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 }}>{label}</div>
        <div style={{ background: bg, color, borderRadius: '8px', padding: '5px', display: 'flex', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '3px' }}>{sub}</div>}
    </div>
  );
}

// ── Flujo de caja bancario ───────────────────────────────────────────────────
function FlujoBancoChart({ data, year, excluidas }: { data: any[]; year: number; excluidas: string[] }) {
  const excStr = excluidas.length > 0 ? `Excluye: ${excluidas.join(', ')}` : 'Sin exclusiones configuradas';
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
        Flujo de caja neto operativo — {year}
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>
        Créditos bancarios − débitos · {excStr}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
          <Tooltip
            formatter={(v: number, name: string) => [formatCurrency(v), name]}
            contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '0.5px solid #e5e7eb' }}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Bar dataKey="neto" name="Neto" radius={[3,3,0,0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.neto >= 0 ? '#0F6E56' : '#993C1D'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Flujo neto contable ──────────────────────────────────────────────────────
function FlujoContableChart({ data, year }: { data: any[]; year: number }) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '4px' }}>
        Flujo neto operativo contable — {year}
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '14px' }}>
        Ventas netas devengadas − compras netas devengadas · por fecha de emisión · NCs restan
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} />
          <Tooltip
            formatter={(v: number, name: string) => [formatCurrency(v), name]}
            contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '0.5px solid #e5e7eb' }}
          />
          <ReferenceLine y={0} stroke="#e5e7eb" />
          <Bar dataKey="neto" name="Neto" radius={[3,3,0,0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.neto >= 0 ? '#185fa5' : '#993C1D'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Aging ────────────────────────────────────────────────────────────────────
function AgingCard({ titulo, aging }: { titulo: string; aging: any }) {
  if (!aging) return null;
  const total = (aging.por_vencer || 0) + (aging.venc_0_30 || 0) + (aging.venc_31_60 || 0) + (aging.venc_mas_60 || 0);
  const rows = [
    { label: 'Por vencer',      importe: aging.por_vencer || 0, count: aging.cnt_por_vencer || 0, color: '#0F6E56', bg: '#e6f4f0' },
    { label: 'Vencido 0-30d',   importe: aging.venc_0_30  || 0, count: aging.cnt_0_30       || 0, color: '#854F0B', bg: '#fef3e2' },
    { label: 'Vencido 31-60d',  importe: aging.venc_31_60 || 0, count: aging.cnt_31_60      || 0, color: '#993C1D', bg: '#f9ece7' },
    { label: 'Vencido +60d',    importe: aging.venc_mas_60|| 0, count: aging.cnt_mas_60     || 0, color: '#7f1d1d', bg: '#fce7e7' },
  ];
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '14px' }}>{titulo}</div>
      {total === 0 ? (
        <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>Sin saldo pendiente</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {rows.map(r => (
            <div key={r.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{r.label} ({r.count})</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: r.color }}>{formatCurrency(r.importe)}</span>
              </div>
              {total > 0 && (
                <div style={{ height: '5px', borderRadius: '3px', background: '#f3f4f6', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((r.importe / total) * 100)}%`, background: r.color, borderRadius: '3px' }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vencimientos agrupados ────────────────────────────────────────────────────
function VencimientosGrupados({ grupos, openGroups, onToggle }: {
  grupos: any[];
  openGroups: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
        Próximos vencimientos (60 días)
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {grupos.map((g) => {
          const isOpen = !!openGroups[g.id];
          const hasItems = g.count > 0;
          return (
            <div key={g.id} style={{ border: '0.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
              {/* Cabecera del grupo */}
              <div
                onClick={() => hasItems && onToggle(g.id)}
                onDoubleClick={() => hasItems && onToggle(g.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', cursor: hasItems ? 'pointer' : 'default',
                  background: hasItems ? (isOpen ? '#f8fafc' : 'white') : '#fafafa',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hasItems ? (
                    isOpen ? <ChevronDown size={14} color="#6b7280" /> : <ChevronRight size={14} color="#6b7280" />
                  ) : (
                    <span style={{ width: 14 }} />
                  )}
                  <span style={{ fontSize: '13px', fontWeight: '600', color: hasItems ? '#1f2937' : '#9ca3af' }}>
                    {g.label}
                  </span>
                  {hasItems && (
                    <span style={{
                      background: '#f3f4f6', color: '#6b7280', borderRadius: '12px',
                      fontSize: '11px', padding: '1px 7px', fontWeight: 600,
                    }}>{g.count}</span>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: hasItems ? '#993C1D' : '#d1d5db' }}>
                  {hasItems ? formatCurrency(g.total) : '—'}
                </div>
              </div>

              {/* Desglose */}
              {isOpen && hasItems && (
                <div style={{ borderTop: '0.5px solid #f3f4f6', background: '#fafbfc' }}>
                  {g.items.map((item: any, i: number) => {
                    const dias = getDiasHastaVencimiento(item.fecha);
                    const col = getColorVencimiento(dias);
                    const colMap = { green: '#0F6E56', yellow: '#854F0B', red: '#993C1D' };
                    const bgMap  = { green: '#e6f4f0', yellow: '#fef3e2', red: '#f9ece7' };
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 14px 8px 36px',
                        borderBottom: i < g.items.length - 1 ? '0.5px solid #f3f4f6' : 'none',
                      }}>
                        <div>
                          <div style={{ fontSize: '12px', color: '#374151' }}>
                            {item.descripcion}{item.numero ? ` · ${item.numero}` : ''}
                          </div>
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '1px' }}>
                            {formatDate(item.fecha)}
                            {' · '}
                            <span style={{
                              background: bgMap[col], color: colMap[col],
                              padding: '0px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
                            }}>
                              {dias < 0 ? `Vencida hace ${Math.abs(dias)}d` : `${dias}d`}
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#993C1D' }}>
                          {formatCurrency(Number(item.importe))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
