"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Search, Edit2, Trash2, X, FileText } from "lucide-react";
import { formatCurrency, formatDate, calcularIVA, getDiasHastaVencimiento, getColorVencimiento } from "@/lib/utils";

const TIPOS_IVA = ['21%', '10.5%', 'exento', 'no_gravado'];
const TIPOS_COMP = ['A', 'B', 'C', 'E', 'M'];
const ESTADOS = ['cobro_pendiente', 'cobrada', 'vencida'];
const ESTADO_LABEL: Record<string, string> = { cobro_pendiente: 'Cobro pendiente', cobrada: 'Cobrada', vencida: 'Vencida', anulada: 'Anulada (NC)' };
const emptyForm = { cliente_id:'', tipo_comprobante:'A', numero:'', fecha_emision:'', fecha_vencimiento:'', importe_neto:'', tipo_iva:'21%', importe_iva:'', importe_total:'', concepto:'', estado:'cobro_pendiente' };

export default function FacturasEmitidasPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [facturas, setFacturas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchFacturas = async () => {
    setLoading(true);
    const res = await fetch(`/api/facturas-emitidas?search=${encodeURIComponent(search)}&estado=${estadoFilter}`);
    setFacturas(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchFacturas(); }, [search, estadoFilter]);
  useEffect(() => { fetch('/api/clientes').then(r => r.json()).then(setClientes); }, []);

  const recalcular = (neto: string, tipoIva: string) => {
    const n = parseFloat(neto) || 0;
    const iva = calcularIVA(n, tipoIva);
    return { importe_iva: iva.toFixed(2), importe_total: (n + iva).toFixed(2) };
  };

  const handleNetoChange = (val: string) => {
    const { importe_iva, importe_total } = recalcular(val, form.tipo_iva);
    setForm(f => ({ ...f, importe_neto: val, importe_iva, importe_total }));
  };

  const handleIvaChange = (val: string) => {
    const { importe_iva, importe_total } = recalcular(form.importe_neto, val);
    setForm(f => ({ ...f, tipo_iva: val, importe_iva, importe_total }));
  };

  const openEdit = (f: any) => {
    setForm({ cliente_id: String(f.cliente_id), tipo_comprobante: f.tipo_comprobante, numero: f.numero, fecha_emision: f.fecha_emision, fecha_vencimiento: f.fecha_vencimiento, importe_neto: String(f.importe_neto), tipo_iva: f.tipo_iva, importe_iva: String(f.importe_iva), importe_total: String(f.importe_total), concepto: f.concepto, estado: f.estado });
    setEditId(f.id); setError(''); setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = editId ? `/api/facturas-emitidas/${editId}` : '/api/facturas-emitidas';
    const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...form, importe_neto: parseFloat(form.importe_neto)||0, importe_iva: parseFloat(form.importe_iva)||0, importe_total: parseFloat(form.importe_total)||0, cliente_id: parseInt(form.cliente_id) }) });
    if (!res.ok) { const e = await res.json(); setError(e.error||'Error'); }
    else { setShowForm(false); fetchFacturas(); }
    setSaving(false);
  };

  const totales = facturas.reduce((acc, f) => ({ neto: acc.neto+f.importe_neto, iva: acc.iva+f.importe_iva, total: acc.total+f.importe_total }), { neto:0, iva:0, total:0 });

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Facturas Emitidas</div>
        {isAdmin && (
          <button onClick={() => { setForm({...emptyForm}); setEditId(null); setError(''); setShowForm(true); }} style={primaryBtn}>
            <Plus size={15} /> Nueva factura
          </button>
        )}
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type="text" placeholder="Buscar factura..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '36px', fontSize: '13px' }} />
          </div>
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} style={{ width: '180px', fontSize: '13px' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          {[
            { label: 'Neto total', val: totales.neto },
            { label: 'IVA total', val: totales.iva },
            { label: 'Total general', val: totales.total, bold: true },
            { label: 'Facturas', val: facturas.length, isCnt: true },
          ].map(t => (
            <div key={t.label} style={{ background: 'white', borderRadius: '8px', padding: '12px 16px', border: '0.5px solid rgba(0,0,0,0.10)', minWidth: '140px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{t.label}</div>
              <div style={{ fontSize: '16px', fontWeight: t.bold ? '700' : '600', color: t.bold ? '#0F6E56' : '#1a1a2e' }}>
                {t.isCnt ? t.val : formatCurrency(t.val as number)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Número</th><th>Cliente</th><th>Fecha emisión</th><th>Vencimiento</th><th>IVA</th><th>Estado</th><th style={{ textAlign: 'right' }}>Neto</th><th style={{ textAlign: 'right' }}>Total</th><th></th></tr>
              </thead>
              <tbody>
                {facturas.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>Sin facturas</td></tr>
                ) : facturas.map((f) => {
                  const dias = getDiasHastaVencimiento(f.fecha_vencimiento);
                  const col = getColorVencimiento(dias);
                  const colMap = { green: '#0F6E56', yellow: '#854F0B', red: '#993C1D' };
                  const bgMap = { green: '#e6f4f0', yellow: '#fef3e2', red: '#f9ece7' };
                  return (
                    <tr key={f.id}>
                      <td><span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '600' }}>{f.tipo_comprobante}-{f.numero}</span></td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{f.cliente_nombre}</div>
                        {f.cuit_receptor && <div style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>{f.cuit_receptor}</div>}
                        {f.concepto && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{f.concepto}</div>}
                      </td>
                      <td style={{ fontSize: '12px' }}>{formatDate(f.fecha_emision)}</td>
                      <td>
                        {f.estado === 'cobro_pendiente' ? (
                          <span style={{ background: bgMap[col], color: colMap[col], padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                            {formatDate(f.fecha_vencimiento)}
                          </span>
                        ) : <span style={{ fontSize: '12px', color: '#9ca3af' }}>{formatDate(f.fecha_vencimiento)}</span>}
                      </td>
                      <td style={{ fontSize: '12px' }}>{f.tipo_iva}</td>
                      <td>
                        <span className={`badge ${f.estado === 'cobrada' ? 'badge-green' : f.estado === 'vencida' ? 'badge-red' : 'badge-blue'}`}>
                          {ESTADO_LABEL[f.estado] || f.estado}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '13px', color: f.tipo_comprobante?.includes('Crédito') ? '#854F0B' : undefined }}>{formatCurrency(f.importe_neto)}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', fontSize: '13px', color: f.tipo_comprobante?.includes('Crédito') ? '#854F0B' : undefined }}>
                        {f.tipo_comprobante?.includes('Crédito') ? '− ' : ''}{formatCurrency(f.importe_total)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                          {f.pdf_path && (
                            <a
                              href={`/api/pdf/${f.pdf_path.replace(/^facturas-pdf\//, '')}`}
                              target="_blank" rel="noopener noreferrer"
                              title="Ver PDF"
                              style={{ background: '#f7f8fa', border: '0.5px solid rgba(0,0,0,0.10)', borderRadius: '7px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#185fa5', textDecoration: 'none' }}
                            >
                              <FileText size={13} />
                            </a>
                          )}
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(f)} style={iconBtn}><Edit2 size={13} /></button>
                              <button onClick={async () => { if (confirm('¿Eliminar?')) { await fetch(`/api/facturas-emitidas/${f.id}`, {method:'DELETE'}); fetchFacturas(); } }} style={{ ...iconBtn, color: '#993C1D' }}><Trash2 size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '28px', width: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{editId ? 'Editar factura emitida' : 'Nueva factura emitida'}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Cliente *</label>
                <select value={form.cliente_id} onChange={(e) => setForm(f => ({ ...f, cliente_id: e.target.value }))}>
                  <option value="">— Seleccioná un cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social} ({c.cuit})</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo</label>
                <select value={form.tipo_comprobante} onChange={(e) => setForm(f => ({ ...f, tipo_comprobante: e.target.value }))}>
                  {TIPOS_COMP.map(t => <option key={t} value={t}>Tipo {t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Número *</label>
                <input value={form.numero} onChange={(e) => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="0001-00003456" />
              </div>
              <div>
                <label style={labelStyle}>Fecha emisión</label>
                <input type="date" value={form.fecha_emision} onChange={(e) => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Fecha vencimiento</label>
                <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Importe neto</label>
                <input type="number" value={form.importe_neto} onChange={(e) => handleNetoChange(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Tipo de IVA</label>
                <select value={form.tipo_iva} onChange={(e) => handleIvaChange(e.target.value)}>
                  {TIPOS_IVA.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>IVA calculado</label>
                <input type="number" value={form.importe_iva} readOnly style={{ background: '#f7f8fa', color: '#6b7280' }} />
              </div>
              <div>
                <label style={labelStyle}>Total</label>
                <input type="number" value={form.importe_total} readOnly style={{ background: '#f7f8fa', color: '#0F6E56', fontWeight: '700' }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Concepto</label>
                <input value={form.concepto} onChange={(e) => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Descripción..." />
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <select value={form.estado} onChange={(e) => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                </select>
              </div>
            </div>
            {error && <div style={{ color: '#993C1D', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtn}>{saving ? 'Guardando...' : 'Guardar factura'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '5px' };
const iconBtn: React.CSSProperties = { background: '#f7f8fa', border: '0.5px solid rgba(0,0,0,0.10)', borderRadius: '7px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6b7280' };
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '7px', background: '#185fa5', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' };
const cancelBtn: React.CSSProperties = { background: 'white', color: '#374151', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: '8px', padding: '9px 20px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' };
