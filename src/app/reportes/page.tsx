"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from 'xlsx';

const currentYear = new Date().getFullYear();
const currentSemestre = new Date().getMonth() < 6 ? 1 : 2;

const MODULOS = [
  { key: 'estado_resultados', label: 'Estado de Resultados' },
  { key: 'iva_compras', label: 'IVA Compras' },
  { key: 'iva_ventas', label: 'IVA Ventas' },
  { key: 'facturas_recibidas', label: 'Facturas Recibidas' },
  { key: 'facturas_emitidas', label: 'Facturas Emitidas' },
];

export default function ReportesPage() {
  const [year, setYear] = useState(currentYear);
  const [semestre, setSemestre] = useState<1|2>(currentSemestre as 1|2);
  const [modulosSeleccionados, setModulosSeleccionados] = useState<string[]>(['estado_resultados']);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('estado_resultados');

  const toggleModulo = (key: string) => {
    setModulosSeleccionados(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleGenerar = async () => {
    setLoading(true);
    const modulos = modulosSeleccionados.join(',');
    const res = await fetch(`/api/reportes?year=${year}&semestre=${semestre}&modulos=${modulos}`);
    const json = await res.json();
    setData(json);
    if (modulosSeleccionados.length > 0) setTab(modulosSeleccionados[0]);
    setLoading(false);
  };

  const exportarExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    if (data.estado_resultados) {
      const rows: any[] = [];
      rows.push(['Código', 'Descripción', 'Tipo', 'Importe']);
      data.estado_resultados.lineas.forEach((l: any) => {
        rows.push([l.codigo, l.descripcion, l.tipo === 'ingreso' ? 'Ingreso' : 'Gasto', l.importe]);
      });
      rows.push([]);
      rows.push(['', 'INGRESOS TOTALES', '', data.estado_resultados.total_ingresos]);
      rows.push(['', 'EGRESOS TOTALES', '', data.estado_resultados.total_egresos]);
      rows.push(['', 'RESULTADO NETO', '', data.estado_resultados.resultado_neto]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Estado de Resultados');
    }

    const addFacturasSheet = (facturas: any[], nombre: string, esCompras: boolean) => {
      if (!facturas?.length) return;
      const headers = ['Tipo', 'Número', 'Fecha', 'CUIT', 'Razón Social', 'Neto', 'IVA', 'Total', 'Estado'];
      const rows = facturas.map(f => [
        f.tipo_comprobante, f.numero, f.fecha_emision, f.cuit, f.razon_social,
        f.importe_neto, f.importe_iva, f.importe_total,
        esCompras ? f.estado : f.estado,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    };

    if (data.iva_compras) addFacturasSheet(data.iva_compras, 'IVA Compras', true);
    if (data.iva_ventas) addFacturasSheet(data.iva_ventas, 'IVA Ventas', false);
    if (data.facturas_recibidas) addFacturasSheet(data.facturas_recibidas, 'Facturas Recibidas', true);
    if (data.facturas_emitidas) addFacturasSheet(data.facturas_emitidas, 'Facturas Emitidas', false);

    XLSX.writeFile(wb, `reporte_contaflow_${year}_S${semestre}.xlsx`);
  };

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Reportes para Contador</div>
        {data && (
          <button onClick={exportarExcel} style={primaryBtn}>
            <Download size={15} /> Exportar Excel
          </button>
        )}
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Panel de configuración */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px 24px', border: '0.5px solid rgba(0,0,0,0.10)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>Período</div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: '90px', fontSize: '13px' }}>
                  {[currentYear-1, currentYear, currentYear+1].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={semestre} onChange={(e) => setSemestre(Number(e.target.value) as 1|2)} style={{ width: '140px', fontSize: '13px' }}>
                  <option value={1}>1° Semestre</option>
                  <option value={2}>2° Semestre</option>
                </select>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>Módulos a incluir</div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {MODULOS.map(m => (
                  <label key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px' }}>
                    <input
                      type="checkbox"
                      checked={modulosSeleccionados.includes(m.key)}
                      onChange={() => toggleModulo(m.key)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ alignSelf: 'flex-end' }}>
              <button onClick={handleGenerar} disabled={loading || modulosSeleccionados.length === 0} style={{ ...primaryBtn, opacity: loading || modulosSeleccionados.length === 0 ? 0.6 : 1 }}>
                {loading ? <><Loader2 size={15} /> Generando...</> : 'Generar reporte'}
              </button>
            </div>
          </div>
        </div>

        {/* Resultado */}
        {data && (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: '2px', background: 'white', borderRadius: '12px 12px 0 0', border: '0.5px solid rgba(0,0,0,0.10)', borderBottom: 'none', overflow: 'hidden' }}>
              {modulosSeleccionados.filter(k => data[k]).map(k => (
                <button key={k} onClick={() => setTab(k)} style={{
                  flex: 1, padding: '11px', border: 'none', cursor: 'pointer', fontSize: '12px',
                  fontWeight: tab === k ? '600' : '400', fontFamily: 'inherit',
                  background: tab === k ? 'white' : '#f7f8fa',
                  color: tab === k ? '#185fa5' : '#6b7280',
                  borderBottom: tab === k ? '2px solid #185fa5' : '2px solid transparent',
                }}>
                  {MODULOS.find(m => m.key === k)?.label}
                </button>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: '0 0 12px 12px', border: '0.5px solid rgba(0,0,0,0.10)', borderTop: 'none', overflow: 'hidden' }}>
              {tab === 'estado_resultados' && data.estado_resultados && (
                <div style={{ padding: '20px 24px' }}>
                  <table className="data-table">
                    <thead>
                      <tr><th>Código</th><th>Descripción</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Importe</th></tr>
                    </thead>
                    <tbody>
                      {data.estado_resultados.lineas.map((l: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{l.codigo}</td>
                          <td>{l.descripcion}</td>
                          <td><span className={`badge ${l.tipo === 'ingreso' ? 'badge-green' : 'badge-red'}`}>{l.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></td>
                          <td style={{ textAlign: 'right', color: l.tipo === 'ingreso' ? '#0F6E56' : '#993C1D', fontWeight: '600' }}>{formatCurrency(l.importe)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f7f8fa' }}>
                        <td colSpan={3} style={{ fontWeight: '700', padding: '12px 14px' }}>Ingresos totales</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#0F6E56', padding: '12px 14px' }}>{formatCurrency(data.estado_resultados.total_ingresos)}</td>
                      </tr>
                      <tr style={{ background: '#f7f8fa' }}>
                        <td colSpan={3} style={{ fontWeight: '700', padding: '12px 14px' }}>Egresos totales</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: '#993C1D', padding: '12px 14px' }}>{formatCurrency(data.estado_resultados.total_egresos)}</td>
                      </tr>
                      <tr style={{ background: '#e8f0fa' }}>
                        <td colSpan={3} style={{ fontWeight: '700', padding: '14px', fontSize: '15px' }}>RESULTADO NETO</td>
                        <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '18px', padding: '14px', color: data.estado_resultados.resultado_neto >= 0 ? '#0F6E56' : '#993C1D' }}>
                          {formatCurrency(data.estado_resultados.resultado_neto)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {['iva_compras', 'iva_ventas', 'facturas_recibidas', 'facturas_emitidas'].includes(tab) && data[tab] && (
                <table className="data-table">
                  <thead>
                    <tr><th>Tipo</th><th>Número</th><th>Fecha</th><th>CUIT</th><th>Razón Social</th><th style={{ textAlign: 'right' }}>Neto</th><th style={{ textAlign: 'right' }}>IVA</th><th style={{ textAlign: 'right' }}>Total</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    {data[tab].map((f: any, i: number) => (
                      <tr key={i}>
                        <td>{f.tipo_comprobante}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{f.numero}</td>
                        <td style={{ fontSize: '12px' }}>{formatDate(f.fecha_emision)}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>{f.cuit}</td>
                        <td style={{ fontSize: '12px' }}>{f.razon_social}</td>
                        <td style={{ textAlign: 'right', fontSize: '12px' }}>{formatCurrency(f.importe_neto)}</td>
                        <td style={{ textAlign: 'right', fontSize: '12px' }}>{formatCurrency(f.importe_iva)}</td>
                        <td style={{ textAlign: 'right', fontWeight: '600', fontSize: '12px' }}>{formatCurrency(f.importe_total)}</td>
                        <td><span className="badge badge-gray" style={{ fontSize: '10px' }}>{f.estado}</span></td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f7f8fa', fontWeight: '700' }}>
                      <td colSpan={5} style={{ padding: '12px 14px' }}>TOTALES</td>
                      <td style={{ textAlign: 'right', padding: '12px 14px' }}>{formatCurrency(data[tab].reduce((a: number, f: any) => a + f.importe_neto, 0))}</td>
                      <td style={{ textAlign: 'right', padding: '12px 14px' }}>{formatCurrency(data[tab].reduce((a: number, f: any) => a + f.importe_iva, 0))}</td>
                      <td style={{ textAlign: 'right', padding: '12px 14px' }}>{formatCurrency(data[tab].reduce((a: number, f: any) => a + f.importe_total, 0))}</td>
                      <td></td>
                    </tr>
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

const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '7px', background: '#185fa5', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' };
