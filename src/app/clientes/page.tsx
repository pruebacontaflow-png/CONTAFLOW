"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Search, Edit2, Trash2, ChevronRight, X, Paperclip } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DocumentosAdjuntos } from "@/components/DocumentosAdjuntos";

const CONDICIONES_IVA = ['Responsable Inscripto','Monotributista','Exento','No Responsable','Consumidor Final'];
const CATEGORIAS = ['Industria','Comercio','Distribución','Retail','Gastronomía','Servicios','Otros'];
const emptyForm = { razon_social:'', cuit:'', categoria:'', email:'', condicion_iva:'Responsable Inscripto' };

export default function ClientesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [clientes, setClientes] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedCliente, setSelectedCliente] = useState<any>(null);
  const [detailFacturas, setDetailFacturas] = useState<any[]>([]);

  const fetchClientes = async () => {
    setLoading(true);
    const res = await fetch(`/api/clientes?search=${encodeURIComponent(search)}`);
    setClientes(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchClientes(); }, [search]);

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = editId ? `/api/clientes/${editId}` : '/api/clientes';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(form) });
    if (!res.ok) { const e = await res.json(); setError(e.error || 'Error'); }
    else { setShowForm(false); fetchClientes(); }
    setSaving(false);
  };

  const openDetail = async (c: any) => {
    setSelectedCliente(c);
    const res = await fetch(`/api/clientes/${c.id}`);
    const data = await res.json();
    setDetailFacturas(data.facturas || []);
  };

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Clientes</div>
        {isAdmin && (
          <button onClick={() => { setForm(emptyForm); setEditId(null); setError(''); setShowForm(true); }} style={primaryBtn}>
            <Plus size={15} /> Nuevo cliente
          </button>
        )}
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        <div style={{ position: 'relative', maxWidth: '360px', marginBottom: '20px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input type="text" placeholder="Buscar cliente..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '36px', fontSize: '13px' }} />
        </div>

        <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Razón Social</th><th>CUIT</th><th>Categoría</th><th>Condición IVA</th>
                <th style={{ textAlign: 'right' }}>Por cobrar</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>Cargando...</td></tr>
              ) : clientes.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>Sin clientes</td></tr>
              ) : clientes.map(c => (
                <tr key={c.id}>
                  <td>
                    <button onClick={() => openDetail(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#185fa5', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit', padding: 0 }}>
                      {c.razon_social}
                    </button>
                    {c.email && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.email}</div>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{c.cuit}</td>
                  <td>{c.categoria || '—'}</td>
                  <td style={{ fontSize: '12px' }}>{c.condicion_iva}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: c.deuda_total > 0 ? '#0F6E56' : '#9ca3af' }}>
                    {c.deuda_total > 0 ? formatCurrency(c.deuda_total) : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      <button onClick={() => openDetail(c)} style={iconBtn}><ChevronRight size={14} /></button>
                      {isAdmin && (
                        <>
                          <button onClick={() => { setForm({ razon_social: c.razon_social, cuit: c.cuit, categoria: c.categoria, email: c.email, condicion_iva: c.condicion_iva }); setEditId(c.id); setError(''); setShowForm(true); }} style={iconBtn}><Edit2 size={14} /></button>
                          <button onClick={async () => { if (confirm('¿Dar de baja?')) { await fetch(`/api/clientes/${c.id}`, { method: 'DELETE' }); fetchClientes(); } }} style={{ ...iconBtn, color: '#993C1D' }}><Trash2 size={14} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '28px', width: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{editId ? 'Editar cliente' : 'Nuevo cliente'}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={labelStyle}>Razón Social *</label>
                <input value={form.razon_social} onChange={(e) => setForm(f => ({ ...f, razon_social: e.target.value }))} placeholder="Nombre empresa" />
              </div>
              <div>
                <label style={labelStyle}>CUIT *</label>
                <input value={form.cuit} onChange={(e) => setForm(f => ({ ...f, cuit: e.target.value }))} placeholder="30-12345678-9" />
              </div>
              <div>
                <label style={labelStyle}>Categoría</label>
                <select value={form.categoria} onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="pagos@empresa.com" />
              </div>
              <div>
                <label style={labelStyle}>Condición IVA</label>
                <select value={form.condicion_iva} onChange={(e) => setForm(f => ({ ...f, condicion_iva: e.target.value }))}>
                  {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {error && <div style={{ color: '#993C1D', fontSize: '13px', marginTop: '10px' }}>{error}</div>}
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtn}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {selectedCliente && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setSelectedCliente(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'relative', width: '520px', height: '100vh', background: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid rgba(0,0,0,0.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700' }}>{selectedCliente.razon_social}</div>
                <div style={{ fontSize: '12px', color: '#9ca3af' }}>{selectedCliente.cuit} · {selectedCliente.condicion_iva}</div>
              </div>
              <button onClick={() => setSelectedCliente(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Info del cliente */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Email</div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{selectedCliente.email || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Por cobrar</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: selectedCliente.deuda_total > 0 ? '#0F6E56' : '#9ca3af' }}>
                    {selectedCliente.deuda_total > 0 ? formatCurrency(selectedCliente.deuda_total) : '—'}
                  </div>
                </div>
              </div>

              {/* Facturas emitidas — tabla resumen */}
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: '#374151' }}>
                Facturas emitidas ({detailFacturas.length})
              </div>
              {detailFacturas.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '24px' }}>Sin facturas registradas</div>
              ) : (
                <table className="data-table" style={{ marginBottom: '24px' }}>
                  <thead><tr><th>Número</th><th>Fecha</th><th>Estado</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                  <tbody>
                    {detailFacturas.map((f: any) => (
                      <tr key={f.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{f.tipo_comprobante}-{f.numero}</td>
                        <td>{formatDate(f.fecha_emision)}</td>
                        <td>
                          <span className={`badge ${f.estado === 'cobrada' ? 'badge-green' : f.estado === 'vencida' ? 'badge-red' : 'badge-blue'}`}>
                            {f.estado === 'cobro_pendiente' ? 'Pendiente' : f.estado === 'cobrada' ? 'Cobrada' : f.estado === 'anulada' ? 'Anulada (NC)' : 'Vencida'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(f.importe_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Documentos adjuntos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Paperclip size={15} color="#185fa5" />
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                  Documentos adjuntos
                </span>
                {detailFacturas.filter((f: any) => f.pdf_path).length > 0 && (
                  <span style={{ background: '#e8f0fa', color: '#185fa5', padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                    {detailFacturas.filter((f: any) => f.pdf_path).length} PDF{detailFacturas.filter((f: any) => f.pdf_path).length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <DocumentosAdjuntos
                facturas={detailFacturas}
                tipo="emitidas"
                onFacturaUpdated={(id, pdfPath) => {
                  setDetailFacturas(prev =>
                    prev.map((f: any) => f.id === id ? { ...f, pdf_path: pdfPath } : f)
                  );
                }}
              />
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
