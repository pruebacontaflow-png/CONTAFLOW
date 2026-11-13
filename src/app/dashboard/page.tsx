"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  Building2, Clock, CheckCircle2, ArrowUpRight,
} from "lucide-react";
import { formatCurrency, formatDate, getDiasHastaVencimiento, getColorVencimiento } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const currentSemestre = currentMonth <= 6 ? 1 : 2;

export default function DashboardPage() {
  const [year, setYear] = useState(currentYear);
  const [semestre, setSemestre] = useState<1|2>(currentSemestre as 1|2);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?year=${year}&semestre=${semestre}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [year, semestre]);

  const AÑOS = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{
        background: 'white',
        borderBottom: '0.5px solid rgba(0,0,0,0.10)',
        padding: '0 28px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>
          Dashboard
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Período:</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ width: '90px', padding: '5px 10px', fontSize: '13px', borderRadius: '7px' }}
          >
            {AÑOS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={semestre}
            onChange={(e) => setSemestre(Number(e.target.value) as 1|2)}
            style={{ width: '130px', padding: '5px 10px', fontSize: '13px', borderRadius: '7px' }}
          >
            <option value={1}>1° Semestre</option>
            <option value={2}>2° Semestre</option>
          </select>
        </div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>
            Cargando métricas...
          </div>
        ) : !data ? null : (
          <>
            {/* Métricas principales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <MetricCard
                label="Ingresos del período"
                value={formatCurrency(data.ingresos)}
                icon={<TrendingUp size={20} />}
                color="#0F6E56"
                bg="#e6f4f0"
              />
              <MetricCard
                label="Egresos del período"
                value={formatCurrency(data.egresos)}
                icon={<TrendingDown size={20} />}
                color="#993C1D"
                bg="#f9ece7"
              />
              <MetricCard
                label="Resultado neto"
                value={formatCurrency(data.resultadoNeto)}
                icon={<DollarSign size={20} />}
                color={data.resultadoNeto >= 0 ? '#0F6E56' : '#993C1D'}
                bg={data.resultadoNeto >= 0 ? '#e6f4f0' : '#f9ece7'}
                highlight
              />
              <MetricCard
                label="Facturas por vencer"
                value={`${data.facturasPorVencer.count} facturas`}
                subtitle={formatCurrency(data.facturasPorVencer.total)}
                icon={<AlertTriangle size={20} />}
                color="#854F0B"
                bg="#fef3e2"
              />
            </div>

            {/* Segunda fila */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <MetricCard
                label="Cobros por vencer (30d)"
                value={`${data.cobrosPorVencer.count} facturas`}
                subtitle={formatCurrency(data.cobrosPorVencer.total)}
                icon={<CheckCircle2 size={20} />}
                color="#185fa5"
                bg="#e8f0fa"
              />
              <MetricCard
                label="Saldo total ARS"
                value={formatCurrency(data.saldoTotal)}
                icon={<Building2 size={20} />}
                color="#185fa5"
                bg="#e8f0fa"
              />
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '18px',
                border: '0.5px solid rgba(0,0,0,0.10)',
                gridColumn: 'span 2',
              }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Saldos por banco
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.saldosBancarios?.slice(0, 4).map((s: any, i: number) => (
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
            </div>

            {/* Inversiones */}
            {data.inversiones && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ background: 'white', borderRadius: '12px', padding: '18px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Inversiones
                  </div>
                  {data.inversiones.total === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>Sin datos — las inversiones se cargarán próximamente</div>
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
                        <div style={{ fontSize: '11px', color: '#9ca3af' }}>Instrumentos activos</div>
                        <div style={{ fontSize: '18px', fontWeight: '700', color: '#374151' }}>{data.inversiones.count}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notas de crédito del período */}
            {((data.ncRecibidas?.count || 0) > 0 || (data.ncEmitidas?.count || 0) > 0) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <MetricCard
                  label={`NCs recibidas del período (${data.ncRecibidas?.count || 0})`}
                  value={formatCurrency(data.ncRecibidas?.total || 0)}
                  subtitle="Reducen el saldo CxP"
                  icon={<ArrowUpRight size={20} />}
                  color="#854F0B"
                  bg="#fef3e2"
                />
                <MetricCard
                  label={`NCs emitidas del período (${data.ncEmitidas?.count || 0})`}
                  value={formatCurrency(data.ncEmitidas?.total || 0)}
                  subtitle="Reducen el saldo CxC"
                  icon={<ArrowUpRight size={20} />}
                  color="#854F0B"
                  bg="#fef3e2"
                />
              </div>
            )}

            {/* Gráficos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              {/* Evolución mensual */}
              <div style={{
                background: 'white', borderRadius: '12px',
                padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                  Evolución mensual — {year} · {semestre}° semestre
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.evolucionMensual} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '0.5px solid #e5e7eb' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#0F6E56" radius={[3,3,0,0]} />
                    <Bar dataKey="egresos" name="Egresos" fill="#993C1D" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Por tipo de comprobante */}
              <div style={{
                background: 'white', borderRadius: '12px',
                padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)',
              }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                  Por tipo de comprobante
                </div>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#0F6E56', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Ingresos (Ventas)
                  </div>
                  {data.ingresosPorTipo?.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>Sin datos</div>
                  ) : data.ingresosPorTipo?.map((t: any) => (
                    <div key={t.tipo_comprobante} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', color: '#374151' }}>Tipo {t.tipo_comprobante}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#0F6E56' }}>{formatCurrency(t.total)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#993C1D', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Egresos (Compras)
                  </div>
                  {data.egresosPorTipo?.length === 0 ? (
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>Sin datos</div>
                  ) : data.egresosPorTipo?.map((t: any) => (
                    <div key={t.tipo_comprobante} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                      <span style={{ fontSize: '13px', color: '#374151' }}>Tipo {t.tipo_comprobante}</span>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#993C1D' }}>{formatCurrency(t.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Aging CxP / CxC */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <AgingCard titulo="Antigüedad CxP (Pagar)" aging={data.agingCxP} />
              <AgingCard titulo="Antigüedad CxC (Cobrar)" aging={data.agingCxC} />
            </div>

            {/* Próximos vencimientos */}
            <div style={{
              background: 'white', borderRadius: '12px',
              padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)',
            }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
                Próximos vencimientos
              </div>
              {data.proxVencimientos?.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                  No hay vencimientos próximos
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vencimiento</th>
                      <th>Descripción</th>
                      <th>Tipo</th>
                      <th>Días restantes</th>
                      <th style={{ textAlign: 'right' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.proxVencimientos.map((v: any, i: number) => {
                      const dias = getDiasHastaVencimiento(v.fecha_vencimiento);
                      const color = getColorVencimiento(dias);
                      const colorMap = { green: '#0F6E56', yellow: '#854F0B', red: '#993C1D' };
                      const bgMap = { green: '#e6f4f0', yellow: '#fef3e2', red: '#f9ece7' };
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: '500' }}>{formatDate(v.fecha_vencimiento)}</td>
                          <td style={{ color: '#374151' }}>
                            {v.tipo === 'factura' ? `${v.descripcion} · ${v.numero}` : v.descripcion}
                          </td>
                          <td>
                            <span className={`badge ${v.tipo === 'fiscal' ? 'badge-blue' : 'badge-gray'}`}>
                              {v.tipo === 'fiscal' ? 'Fiscal' : 'Factura'}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              background: bgMap[color], color: colorMap[color],
                              padding: '2px 8px', borderRadius: '12px',
                              fontSize: '11px', fontWeight: '600',
                            }}>
                              <Clock size={10} />
                              {dias < 0 ? `Vencida hace ${Math.abs(dias)}d` : `${dias} días`}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '600', color: '#993C1D' }}>
                            {formatCurrency(v.importe)}
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
    </AppLayout>
  );
}

function AgingCard({ titulo, aging }: { titulo: string; aging: any }) {
  if (!aging) return null;
  const total = (aging.por_vencer || 0) + (aging.venc_0_30 || 0) + (aging.venc_31_60 || 0) + (aging.venc_mas_60 || 0);
  const rows = [
    { label: 'Por vencer', importe: aging.por_vencer || 0, count: aging.cnt_por_vencer || 0, color: '#0F6E56', bg: '#e6f4f0' },
    { label: 'Vencido 0-30 días', importe: aging.venc_0_30 || 0, count: aging.cnt_0_30 || 0, color: '#854F0B', bg: '#fef3e2' },
    { label: 'Vencido 31-60 días', importe: aging.venc_31_60 || 0, count: aging.cnt_31_60 || 0, color: '#993C1D', bg: '#f9ece7' },
    { label: 'Vencido +60 días', importe: aging.venc_mas_60 || 0, count: aging.cnt_mas_60 || 0, color: '#7f1d1d', bg: '#fce7e7' },
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
          <div style={{ borderTop: '0.5px solid #e5e7eb', paddingTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Total</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a2e' }}>{formatCurrency(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label, value, subtitle, icon, color, bg, highlight
}: {
  label: string; value: string; subtitle?: string;
  icon: React.ReactNode; color: string; bg: string; highlight?: boolean;
}) {
  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '18px',
      border: highlight ? `0.5px solid ${color}40` : '0.5px solid rgba(0,0,0,0.10)',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280', lineHeight: 1.3 }}>{label}</div>
        <div style={{
          background: bg, color: color,
          borderRadius: '8px', width: '34px', height: '34px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
      <div>
        <div style={{ fontSize: '22px', fontWeight: '700', color: highlight ? color : '#1a1a2e', lineHeight: 1.2 }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{subtitle}</div>
        )}
      </div>
    </div>
  );
}
