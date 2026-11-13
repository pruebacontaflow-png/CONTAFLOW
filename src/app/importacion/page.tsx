"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Upload, Download, CheckCircle, AlertTriangle, XCircle, FileText } from "lucide-react";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

const TIPOS = [
  { key: 'proveedores', label: 'Proveedores', columnas: ['razon_social', 'cuit', 'categoria', 'email', 'telefono', 'condicion_iva'] },
  { key: 'clientes', label: 'Clientes', columnas: ['razon_social', 'cuit', 'categoria', 'email', 'condicion_iva'] },
  { key: 'facturas_recibidas', label: 'Facturas Recibidas', columnas: ['cuit_proveedor', 'tipo_comprobante', 'numero', 'fecha_emision', 'fecha_vencimiento', 'importe_neto', 'tipo_iva', 'concepto', 'estado'] },
];

export default function ImportacionPage() {
  const [tipo, setTipo] = useState('proveedores');
  const [archivo, setArchivo] = useState<File|null>(null);
  const [filasParsed, setFilasParsed] = useState<any[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState('');

  const tipoActual = TIPOS.find(t => t.key === tipo)!;

  const descargarPlantilla = () => {
    const ws = XLSX.utils.aoa_to_sheet([tipoActual.columnas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, `plantilla_${tipo}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    setResultado(null);
    setError('');

    const nombre = f.name.toLowerCase();
    if (nombre.endsWith('.csv')) {
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => setFilasParsed(res.data as any[]),
        error: () => setError('Error al parsear el CSV'),
      });
    } else if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(ev.target?.result, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
          setFilasParsed(data as any[]);
        } catch {
          setError('Error al leer el archivo Excel');
        }
      };
      reader.readAsArrayBuffer(f);
    } else {
      setError('Formato no soportado. Usá .xlsx o .csv');
    }
  };

  const handleImportar = async () => {
    if (filasParsed.length === 0) { setError('No hay filas para importar'); return; }
    setProcesando(true); setError('');
    const res = await fetch('/api/importacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, filas: filasParsed }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error || 'Error');
    else setResultado(data);
    setProcesando(false);
  };

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Importación desde Excel / CSV</div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Panel de configuración */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', border: '0.5px solid rgba(0,0,0,0.10)', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Configuración de importación</div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Tipo de datos</label>
              <select value={tipo} onChange={(e) => { setTipo(e.target.value); setArchivo(null); setFilasParsed([]); setResultado(null); }} style={{ width: '200px' }}>
                {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>

            <button onClick={descargarPlantilla} style={{ ...cancelBtn, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
              <Download size={14} /> Descargar plantilla
            </button>
          </div>

          {/* Columnas esperadas */}
          <div style={{ marginTop: '16px', padding: '12px 16px', background: '#f7f8fa', borderRadius: '8px', fontSize: '12px' }}>
            <strong style={{ color: '#374151' }}>Columnas esperadas:</strong>{' '}
            <span style={{ color: '#6b7280', fontFamily: 'monospace' }}>{tipoActual.columnas.join(' · ')}</span>
          </div>

          {/* Upload */}
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f7f8fa', border: '0.5px dashed #c1c7d0', borderRadius: '8px', padding: '14px 20px', cursor: 'pointer', width: 'fit-content' }}>
              <Upload size={18} color="#185fa5" />
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                  {archivo ? archivo.name : 'Seleccionar archivo Excel o CSV'}
                </div>
                {filasParsed.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#0F6E56', marginTop: '2px' }}>
                    {filasParsed.length} filas detectadas
                  </div>
                )}
              </div>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: 'none' }} />
            </label>
          </div>

          {error && (
            <div style={{ marginTop: '12px', background: '#f9ece7', border: '0.5px solid #993C1D', borderRadius: '8px', padding: '10px 14px', color: '#993C1D', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {filasParsed.length > 0 && !resultado && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={handleImportar} disabled={procesando} style={primaryBtn}>
                {procesando ? 'Importando...' : `Importar ${filasParsed.length} registros`}
              </button>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                Se importarán {filasParsed.length} filas del archivo
              </span>
            </div>
          )}
        </div>

        {/* Preview filas */}
        {filasParsed.length > 0 && !resultado && (
          <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden', marginBottom: '20px' }}>
            <div style={{ padding: '14px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: '600' }}>
              Vista previa — primeras 5 filas
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>{Object.keys(filasParsed[0] || {}).map(k => <th key={k}>{k}</th>)}</tr>
                </thead>
                <tbody>
                  {filasParsed.slice(0, 5).map((f, i) => (
                    <tr key={i}>
                      {Object.values(f).map((v: any, j) => <td key={j} style={{ fontSize: '12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Resultado */}
        {resultado && (
          <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px' }}>Resultado de la importación</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#e6f4f0', padding: '10px 16px', borderRadius: '8px' }}>
                  <CheckCircle size={18} color="#0F6E56" />
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#0F6E56' }}>{resultado.importados}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Importados</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef3e2', padding: '10px 16px', borderRadius: '8px' }}>
                  <AlertTriangle size={18} color="#854F0B" />
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#854F0B' }}>{resultado.observaciones.length}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Con observaciones</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f9ece7', padding: '10px 16px', borderRadius: '8px' }}>
                  <XCircle size={18} color="#993C1D" />
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#993C1D' }}>{resultado.rechazados.length}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>Rechazados</div>
                  </div>
                </div>
              </div>
            </div>

            {(resultado.observaciones.length > 0 || resultado.rechazados.length > 0) && (
              <div style={{ padding: '20px 24px' }}>
                {resultado.observaciones.length > 0 && (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#854F0B', marginBottom: '10px' }}>Con observaciones</div>
                    <table className="data-table" style={{ marginBottom: '16px' }}>
                      <thead><tr><th>Fila</th><th>Motivo</th></tr></thead>
                      <tbody>
                        {resultado.observaciones.map((o: any, i: number) => (
                          <tr key={i}><td>{o.fila}</td><td style={{ color: '#854F0B' }}>{o.motivo}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                {resultado.rechazados.length > 0 && (
                  <>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#993C1D', marginBottom: '10px' }}>Rechazados</div>
                    <table className="data-table">
                      <thead><tr><th>Fila</th><th>Motivo</th></tr></thead>
                      <tbody>
                        {resultado.rechazados.map((r: any, i: number) => (
                          <tr key={i}><td>{r.fila}</td><td style={{ color: '#993C1D' }}>{r.motivo}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '5px' };
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '7px', background: '#185fa5', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' };
const cancelBtn: React.CSSProperties = { background: 'white', color: '#374151', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', padding: '9px 20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' };
