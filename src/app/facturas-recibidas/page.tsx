"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Search, Edit2, Trash2, X, FileText, ExternalLink, ClipboardCheck } from "lucide-react";
import { formatCurrency, formatDate, calcularIVA, getDiasHastaVencimiento, getColorVencimiento } from "@/lib/utils";

const TIPOS_IVA = ['21%', '10.5%', 'exento', 'no_gravado'];
const TIPOS_COMP = ['A', 'B', 'C', 'E', 'M'];
const ESTADOS = ['pendiente_revision', 'requiere_revision', 'pendiente_pago', 'pagada', 'anulada', 'nc_aplicada', 'observada', 'rechazada'];
const ESTADO_LABEL: Record<string, string> = {
  pendiente_revision: 'Pendiente revisión',
  requiere_revision:  'Requiere revisión',
  pendiente_pago: 'Pendiente de pago',
  pagada: 'Pagada',
  anulada: 'Anulada (NC)',
  nc_aplicada: 'NC aplicada',
  observada: 'Observada',
  rechazada: 'Rechazada',
};

const emptyForm = {
  proveedor_id: '', tipo_comprobante: 'A', numero: '',
  fecha_emision: '', fecha_vencimiento: '',
  importe_neto: '', tipo_iva: '21%',
  importe_iva: '', importe_total: '',
  concepto: '', estado: 'pendiente_pago',
};

export default function FacturasRecibidasPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [facturas, setFacturas] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revisionModal, setRevisionModal] = useState<any>(null);
  const [revisionAcion, setRevisionAccion] = useState<'aprobar'|'observar'>('aprobar');
  const [revisionComentario, setRevisionComentario] = useState('');
  const [revisionSaving, setRevisionSaving] = useState(false);
  const [showNdiForm, setShowNdiForm] = useState(false);
  const [ndiForm, setNdiForm] = useState({ fecha_emision: '', fecha_vencimiento: '', importe: '', motivo_interna: '', numero: '' });
  const [ndiSaving, setNdiSaving] = useState(false);
  const [ndiError, setNdiError] = useState('');

  const handleRevisar = async () => {
    if (!revisionModal) return;
    setRevisionSaving(true);
    const res = await fetch(`/api/facturas-recibidas/${revisionModal.id}/revisar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: revisionAcion, comentario: revisionComentario }),
    });
    if (res.ok) {
      setRevisionModal(null);
      setRevisionComentario('');
      fetchFacturas();
    }
    setRevisionSaving(false);
  };

  const fetchFacturas = async () => {
    setLoading(true);
    const res = await fetch(`/api/facturas-recibidas?search=${encodeURIComponent(search)}&estado=${estadoFilter}`);
    setFacturas(await res.json());
    setLoading(false);
  };

  const fetchProveedores = async () => {
    const res = await fetch('/api/proveedores');
    setProveedores(await res.json());
  };

  useEffect(() => { fetchFacturas(); }, [search, estadoFilter]);
  useEffect(() => { fetchProveedores(); }, []);

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

  const openCreate = () => {
    setForm({ ...emptyForm });
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (f: any) => {
    setForm({
      proveedor_id: String(f.proveedor_id),
      tipo_comprobante: f.tipo_comprobante,
      numero: f.numero,
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: f.fecha_vencimiento,
      importe_neto: String(f.importe_neto),
      tipo_iva: f.tipo_iva,
      importe_iva: String(f.importe_iva),
      importe_total: String(f.importe_total),
      concepto: f.concepto,
      estado: f.estado,
    });
    setEditId(f.id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const url = editId ? `/api/facturas-recibidas/${editId}` : '/api/facturas-recibidas';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          importe_neto: parseFloat(form.importe_neto) || 0,
          importe_iva: parseFloat(form.importe_iva) || 0,
          importe_total: parseFloat(form.importe_total) || 0,
          proveedor_id: parseInt(form.proveedor_id),
        }),
      });
      if (!res.ok) {
        const e = await res.json();
        setError(e.error || 'Error al guardar');
      } else {
        setShowForm(false);
        fetchFacturas();
      }
    } catch { setError('Error de conexión'); }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta factura?')) return;
    await fetch(`/api/facturas-recibidas/${id}`, { method: 'DELETE' });
    fetchFacturas();
  };

  const handleSaveNdi = async () => {
    setNdiSaving(true);
    setNdiError('');
    const res = await fetch('/api/ndi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...ndiForm, importe: parseFloat(ndiForm.importe) || 0 }),
    });
    if (res.ok) {
      setShowNdiForm(false);
      setNdiForm({ fecha_emision: '', fecha_vencimiento: '', importe: '', motivo_interna: '', numero: '' });
      fetchFacturas();
    } else {
      const j = await res.json();
      setNdiError(j.error || 'Error al guardar');
    }
    setNdiSaving(false);
  };

  const totales = facturas.reduce((acc, f) => ({
    neto: acc.neto + f.importe_neto,
    iva: acc.iva + f.importe_iva,
    total: acc.total + f.importe_total,
  }), { neto: 0, iva: 0, total: 0 });

  return (
    <AppLayout>
      <div style={{
        background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)',
        padding: '0 28px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>Facturas Recibidas</div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { setNdiForm({ fecha_emision: '', fecha_vencimiento: '', importe: '', motivo_interna: '', numero: '' }); setNdiError(''); setShowNdiForm(true); }} style={{ ...primaryBtn, background: '#854F0B' }}>
              <Plus size={15} /> NDI
            </button>
            <button onClick={openCreate} style={primaryBtn}>
              <Plus size={15} /> Nueva factura
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Filtros */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input type="text" placeholder="Buscar factura..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '13px' }} />
          </div>
          <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}
            style={{ width: '180px', fontSize: '13px', padding: '8px 12px' }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
        </div>

        {/* Totales */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          {[
            { label: 'Neto total', val: totales.neto },
            { label: 'IVA total', val: totales.iva },
            { label: 'Total general', val: totales.total, bold: true },
          ].map(t => (
            <div key={t.label} style={{
              background: 'white', borderRadius: '8px', padding: '12px 16px',
              border: '0.5px solid rgba(0,0,0,0.10)', minWidth: '160px',
            }}>
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>{t.label}</div>
              <div style={{ fontSize: '16px', fontWeight: t.bold ? '700' : '600', color: t.bold ? '#993C1D' : '#1a1a2e' }}>
                {formatCurrency(t.val)}
              </div>
            </div>
          ))}
          <div style={{ background: 'white', borderRadius: '8px', padding: '12px 16px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
            <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>Facturas</div>
            <div style={{ fontSize: '16px', fontWeight: '600' }}>{facturas.length}</div>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Proveedor</th>
                  <th>Fecha emisión</th>
                  <th>Vencimiento</th>
                  <th>IVA</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Neto</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {facturas.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                    Sin facturas{search ? ' para esa búsqueda' : ''}
                  </td></tr>
                ) : facturas.map((f) => {
                  const dias = getDiasHastaVencimiento(f.fecha_vencimiento);
                  const col = getColorVencimiento(dias);
                  const colMap = { green: '#0F6E56', yellow: '#854F0B', red: '#993C1D' };
                  const bgMap = { green: '#e6f4f0', yellow: '#fef3e2', red: '#f9ece7' };
                  return (
                    <tr key={f.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '600' }}>
                          {f.tipo_comprobante}-{f.numero}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>{f.proveedor_nombre}</div>
                        {f.cuit_emisor && <div style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>{f.cuit_emisor}</div>}
                        {f.concepto && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{f.concepto}</div>}
                      </td>
                      <td style={{ fontSize: '12px' }}>{formatDate(f.fecha_emision)}</td>
                      <td>
                        {f.estado === 'pendiente_pago' ? (
                          <span style={{
                            background: bgMap[col], color: colMap[col],
                            padding: '2px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                          }}>
                            {formatDate(f.fecha_vencimiento)}
                          </span>
                        ) : <span style={{ fontSize: '12px', color: '#9ca3af' }}>{formatDate(f.fecha_vencimiento)}</span>}
                      </td>
                      <td style={{ fontSize: '12px' }}>{f.tipo_iva}</td>
                      <td>
                        <span className={`badge ${
                          f.estado === 'pagada' ? 'badge-green' :
                          f.estado === 'anulada' || f.estado === 'nc_aplicada' ? 'badge-gray' :
                          f.estado === 'observada' ? 'badge-yellow' :
                          f.estado === 'pendiente_revision' ? 'badge-blue' :
                          f.estado === 'requiere_revision' ? 'badge-yellow' :
                          f.estado === 'rechazada' ? 'badge-red' : 'badge-red'
                        }`}>
                          {ESTADO_LABEL[f.estado] || f.estado}
                        </span>
                        {(f.estado === 'anulada' || f.estado === 'nc_aplicada') && f.comentario_admin ? <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{String(f.comentario_admin).split(' | ').find((c: string) => c.startsWith('Anulada por') || c.startsWith('Anula')) || ''}</div> : null}
                        {f.cargada_por_proveedor ? <span style={{ marginLeft: '4px', fontSize: '9px', background: '#e8f0fa', color: '#185fa5', padding: '1px 5px', borderRadius: '8px', fontWeight: '600' }}>PROV</span> : null}
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
                              style={{ ...iconBtn, textDecoration: 'none', color: '#185fa5' }}
                            >
                              <FileText size={13} />
                            </a>
                          )}
                          {isAdmin && (
                            <>
                              {f.estado === 'pendiente_revision' && (
                                <button
                                  onClick={() => { setRevisionModal(f); setRevisionAccion('aprobar'); setRevisionComentario(''); }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#e8f0fa', color: '#185fa5', border: '0.5px solid #c3d9f4', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                                >
                                  <ClipboardCheck size={11} /> Revisar
                                </button>
                              )}
                              <button onClick={() => openEdit(f)} style={iconBtn}><Edit2 size={13} /></button>
                              <button onClick={() => handleDelete(f.id)} style={{ ...iconBtn, color: '#993C1D' }}><Trash2 size={13} /></button>
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
          <div style={{
            position: 'relative', background: 'white', borderRadius: '12px',
            padding: '28px', width: '640px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{editId ? 'Editar factura recibida' : 'Nueva factura recibida'}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Proveedor *</label>
                <select value={form.proveedor_id} onChange={(e) => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">— Seleccioná un proveedor —</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.razon_social} ({p.cuit})</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select value={form.tipo_comprobante} onChange={(e) => setForm(f => ({ ...f, tipo_comprobante: e.target.value }))}>
                  {TIPOS_COMP.map(t => <option key={t} value={t}>Tipo {t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Número *</label>
                <input value={form.numero} onChange={(e) => setForm(f => ({ ...f, numero: e.target.value }))} placeholder="0001-00001234" />
              </div>
              <div>
                <label style={labelStyle}>Fecha de emisión *</label>
                <input type="date" value={form.fecha_emision} onChange={(e) => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Fecha de vencimiento *</label>
                <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Importe neto *</label>
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
                <input type="number" value={form.importe_total} readOnly style={{ background: '#f7f8fa', color: '#185fa5', fontWeight: '700' }} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Concepto</label>
                <input value={form.concepto} onChange={(e) => setForm(f => ({ ...f, concepto: e.target.value }))} placeholder="Descripción del servicio o bien..." />
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
              <button onClick={handleSave} disabled={saving} style={primaryBtn}>
                {saving ? 'Guardando...' : 'Guardar factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nota de Débito Interna */}
      {showNdiForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowNdiForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '28px', width: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>Nueva Nota de Débito Interna</div>
              <button onClick={() => setShowNdiForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ background: '#fef3e2', border: '0.5px solid #f9d9a8', borderRadius: '8px', padding: '10px 14px', marginBottom: '18px', fontSize: '12px', color: '#854F0B' }}>
              Una NDI es un ajuste interno. Se registra como factura interna para controlar la obligación de pago.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Motivo *</label>
                <input value={ndiForm.motivo_interna} onChange={e => setNdiForm(f => ({ ...f, motivo_interna: e.target.value }))} placeholder="Descripción del débito interno..." />
              </div>
              <div>
                <label style={labelStyle}>Fecha emisión *</label>
                <input type="date" value={ndiForm.fecha_emision} onChange={e => setNdiForm(f => ({ ...f, fecha_emision: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Fecha vencimiento *</label>
                <input type="date" value={ndiForm.fecha_vencimiento} onChange={e => setNdiForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Importe *</label>
                <input type="number" value={ndiForm.importe} onChange={e => setNdiForm(f => ({ ...f, importe: e.target.value }))} placeholder="0.00" step="0.01" />
              </div>
              <div>
                <label style={labelStyle}>Número (opcional)</label>
                <input value={ndiForm.numero} onChange={e => setNdiForm(f => ({ ...f, numero: e.target.value }))} placeholder="NDI-001..." />
              </div>
            </div>
            {ndiError && <div style={{ color: '#993C1D', fontSize: '13px', marginTop: '12px', background: '#f9ece7', padding: '10px', borderRadius: '8px' }}>{ndiError}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNdiForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveNdi} disabled={ndiSaving || !ndiForm.motivo_interna || !ndiForm.fecha_emision || !ndiForm.fecha_vencimiento || !ndiForm.importe} style={{ ...primaryBtn, background: '#854F0B' }}>
                {ndiSaving ? 'Guardando...' : 'Guardar NDI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal revisión de factura proveedor */}
      {revisionModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setRevisionModal(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '28px', width: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>Revisar factura del proveedor</div>
              <button onClick={() => setRevisionModal(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ background: '#f0f7ff', border: '0.5px solid #c3d9f4', borderRadius: '8px', padding: '12px 14px', marginBottom: '18px', fontSize: '13px', color: '#374151' }}>
              <strong>{revisionModal.tipo_comprobante}-{revisionModal.numero}</strong> · {revisionModal.proveedor_nombre} · {formatCurrency(revisionModal.importe_total)}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>Acción</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: revisionAcion === 'aprobar' ? '600' : '400', color: revisionAcion === 'aprobar' ? '#0F6E56' : '#374151' }}>
                  <input type="radio" checked={revisionAcion === 'aprobar'} onChange={() => setRevisionAccion('aprobar')} />
                  ✓ Aprobar (pasa a "Pendiente pago")
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', fontWeight: revisionAcion === 'observar' ? '600' : '400', color: revisionAcion === 'observar' ? '#993C1D' : '#374151' }}>
                  <input type="radio" checked={revisionAcion === 'observar'} onChange={() => setRevisionAccion('observar')} />
                  ⚠ Observar (requiere corrección)
                </label>
              </div>
            </div>
            {revisionAcion === 'observar' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Comentario para el proveedor *</label>
                <textarea value={revisionComentario} onChange={e => setRevisionComentario(e.target.value)}
                  placeholder="Explicá qué debe corregir el proveedor..."
                  rows={3}
                  style={{ resize: 'vertical', fontSize: '13px' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setRevisionModal(null)} style={cancelBtn}>Cancelar</button>
              <button
                onClick={handleRevisar}
                disabled={revisionSaving || (revisionAcion === 'observar' && !revisionComentario.trim())}
                style={{ ...primaryBtn, background: revisionAcion === 'aprobar' ? '#0F6E56' : '#993C1D' }}
              >
                {revisionSaving ? 'Procesando...' : revisionAcion === 'aprobar' ? '✓ Aprobar factura' : '⚠ Marcar observada'}
              </button>
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
