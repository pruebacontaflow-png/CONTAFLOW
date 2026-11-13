"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

const currentYear = new Date().getFullYear();

export default function CashFlowPage() {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch(`/api/cashflow?year=${year}`);
    setData(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [year]);

  const totales = data.reduce((acc, m) => ({
    ingresos: acc.ingresos + m.ingresos,
    egresos: acc.egresos + m.total_egresos,
    saldo: acc.saldo + m.saldo,
  }), { ingresos: 0, egresos: 0, saldo: 0 });

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Cash Flow Proyectado</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6b7280' }}>Año:</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '90px', padding: '5px 10px', fontSize: '13px' }}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Totales anuales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px 22px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Ingresos proyectados {year}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#0F6E56' }}>{formatCurrency(totales.ingresos)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px 22px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Egresos proyectados {year}</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#993C1D' }}>{formatCurrency(totales.egresos)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px 22px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Saldo neto proyectado</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: totales.saldo >= 0 ? '#0F6E56' : '#993C1D' }}>{formatCurrency(totales.saldo)}</div>
          </div>
        </div>

        {/* Gráfico */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)', marginBottom: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>Evolución mensual {year}</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => v.slice(0, 3)} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: '12px', borderRadius: '8px', border: '0.5px solid #e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <ReferenceLine y={0} stroke="#e5e7eb" />
              <Bar dataKey="ingresos" name="Ingresos" fill="#0F6E56" radius={[3,3,0,0]} />
              <Bar dataKey="egresos_facturas" name="Egresos Facturas" fill="#993C1D" radius={[3,3,0,0]} />
              <Bar dataKey="egresos_fiscales" name="Egresos Fiscales" fill="#854F0B" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabla mensual */}
        <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th style={{ textAlign: 'right' }}>Ingresos esperados</th>
                  <th style={{ textAlign: 'right' }}>Egresos facturas</th>
                  <th style={{ textAlign: 'right' }}>Egresos fiscales</th>
                  <th style={{ textAlign: 'right' }}>Total egresos</th>
                  <th style={{ textAlign: 'right' }}>Saldo proyectado</th>
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.mesNum}>
                    <td style={{ fontWeight: '500', textTransform: 'capitalize' }}>{m.mes}</td>
                    <td style={{ textAlign: 'right', color: '#0F6E56', fontWeight: '600' }}>{formatCurrency(m.ingresos)}</td>
                    <td style={{ textAlign: 'right', color: '#993C1D' }}>{formatCurrency(m.egresos_facturas)}</td>
                    <td style={{ textAlign: 'right', color: '#854F0B' }}>{formatCurrency(m.egresos_fiscales)}</td>
                    <td style={{ textAlign: 'right', color: '#993C1D', fontWeight: '600' }}>{formatCurrency(m.total_egresos)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '700', color: m.saldo >= 0 ? '#0F6E56' : '#993C1D' }}>
                      {formatCurrency(m.saldo)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: '#f7f8fa', fontWeight: '700' }}>
                  <td>TOTAL ANUAL</td>
                  <td style={{ textAlign: 'right', color: '#0F6E56' }}>{formatCurrency(totales.ingresos)}</td>
                  <td colSpan={2} style={{ textAlign: 'right', color: '#993C1D' }}></td>
                  <td style={{ textAlign: 'right', color: '#993C1D' }}>{formatCurrency(totales.egresos)}</td>
                  <td style={{ textAlign: 'right', color: totales.saldo >= 0 ? '#0F6E56' : '#993C1D' }}>{formatCurrency(totales.saldo)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
