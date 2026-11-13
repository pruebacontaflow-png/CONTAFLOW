"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import {
  Plus, Search, Edit2, Trash2, ChevronRight, X,
  CheckCircle, AlertCircle, XCircle, Building2, Paperclip, ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DocumentosAdjuntos } from "@/components/DocumentosAdjuntos";

const CONDICIONES_IVA = [
  'Responsable Inscripto',
  'Monotributista',
  'Exento',
  'No Responsable',
  'Consumidor Final',
];

const CATEGORIAS = [
  'Tecnología', 'Insumos', 'Logística', 'Consultoría',
  'Seguros', 'Servicios', 'Marketing', 'Otros',
];

function getEstado(facturas_pendientes: number, total_facturas: number) {
  if (total_facturas === 0) return { label: 'Sin facturas', color: 'gray' };
  if (facturas_pendientes === 0) return { label: 'Al día', color: 'green' };
  if (facturas_pendientes > 0) return { label: 'Factura pendiente', color: 'yellow' };
  return { label: 'Sin autorización', color: 'red' };
}

const emptyForm = {
  razon_social: '', cuit: '', categoria: '',
  email: '', telefono: '', condicion_iva: 'Responsable Inscripto',
};

export default function ProveedoresPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [proveedores, setProveedores] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedProveedor, setSelectedProveedor] = useState<any>(null);
  const [detailFacturas, setDetailFacturas] = useState<any[]>([]);

  const fetchProveedores = async () => {
    setLoading(true);
    const res = await fetch(`/api/proveedores?search=${encodeURIComponent(search)}`);
    const data = await res.json();
    setProveedores(data);
    setLoading(false);
  };

  useEffect(() => { fetchProveedores(); }, [search]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setError('');
    setShowForm(true);
  };

  const openEdit = (p: any) => {
    setForm({
      razon_social: p.razon_social, cuit: p.cuit, categoria: p.categoria,
      email: p.email, telefono: p.telefono, condicion_iva: p.condicion_iva,
    });
    setEditId(p.id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const url = editId ? `/api/proveedores/${editId}` : '/api/proveedores';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        setError(e.error || 'Error al guardar');
      } else {
        setShowForm(false);
        fetchProveedores();
      }
    } catch (e) {
      setError('Error de conexión');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Dar de baja este proveedor?')) return;
    await fetch(`/api/proveedores/${id}`, { method: 'DELETE' });
    fetchProveedores();
  };

  const openDetail = async (p: any) => {
    setSelectedProveedor(p);
    const res = await fetch(`/api/proveedores/${p.id}`);
    const data = await res.json();
    setDetailFacturas(data.facturas || []);
  };

  return (
    <AppLayout>
      {/* Header */}
      <div style={{
        background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)',
        padding: '0 28px', height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: '#1a1a2e' }}>Proveedores</div>
        {isAdmin && (
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: '#185fa5', color: 'white', border: 'none',
            borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
            fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Plus size={15} /> Nuevo proveedor
          </button>
        )}
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Búsqueda */}
        <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text" placeholder="Buscar por razón social, CUIT, código..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', fontSize: '13px' }}
          />
        </div>

        {/* Tabla */}
        <div style={{
          background: 'white', borderRadius: '12px',
          border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden',
        }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Razón Social</th>
                  <th>CUIT</th>
                  <th>Servicio / Categoría</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Deuda</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {proveedores.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>
                    No hay proveedores{search ? ' para esa búsqueda' : ''}.{isAdmin && ' Agregá el primero →'}
                  </td></tr>
                ) : proveedores.map((p) => {
                  const estado = getEstado(p.facturas_pendientes, p.total_facturas);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {p.codigo_proveedor || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td>
                        <button onClick={() => openDetail(p)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: '#185fa5', fontWeight: '600', fontSize: '13px',
                          fontFamily: 'inherit', padding: 0, textAlign: 'left',
                        }}>
                          {p.razon_social}
                        </button>
                        {p.email && <div style={{ fontSize: '11px', color: '#9ca3af' }}>{p.email}</div>}
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.cuit}</td>
                      <td style={{ fontSize: '12px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.servicio || p.categoria || <span style={{ color: '#d1d5db' }}>—</span>}
                      </td>
                      <td>
                        <span className={`badge badge-${estado.color}`}>{estado.label}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: '600', color: p.deuda_total > 0 ? '#993C1D' : '#9ca3af' }}>
                        {p.deuda_total > 0 ? formatCurrency(p.deuda_total) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {(p.drive_carpeta_anio || p.drive_carpeta) && (
                            <a href={p.drive_carpeta_anio || p.drive_carpeta} target="_blank" rel="noopener noreferrer"
                              title="Abrir carpeta Drive 2026" onClick={e => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '26px', height: '26px', borderRadius: '6px',
                                border: '0.5px solid #e5e7eb', textDecoration: 'none', color: '#185fa5' }}>
                              <ExternalLink size={12} />
                            </a>
                          )}
                          <button onClick={() => openDetail(p)} style={iconBtn}>
                            <ChevronRight size={14} />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => openEdit(p)} style={iconBtn}><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(p.id)} style={{ ...iconBtn, color: '#993C1D' }}>
                                <Trash2 size={14} />
                              </button>
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

      {/* Modal form */}
      {showForm && (
        <Modal title={editId ? 'Editar proveedor' : 'Nuevo proveedor'} onClose={() => setShowForm(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <FormField label="Razón Social *" colSpan>
              <input value={form.razon_social} onChange={(e) => setForm(f => ({ ...f, razon_social: e.target.value }))} placeholder="Ej: Servicios SA" />
            </FormField>
            <FormField label="CUIT *">
              <input value={form.cuit} onChange={(e) => setForm(f => ({ ...f, cuit: e.target.value }))} placeholder="20-12345678-9" />
            </FormField>
            <FormField label="Categoría">
              <select value={form.categoria} onChange={(e) => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">— Seleccionar —</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Condición IVA">
              <select value={form.condicion_iva} onChange={(e) => setForm(f => ({ ...f, condicion_iva: e.target.value }))}>
                {CONDICIONES_IVA.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
            <FormField label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="facturacion@empresa.com" />
            </FormField>
            <FormField label="Teléfono">
              <input value={form.telefono} onChange={(e) => setForm(f => ({ ...f, telefono: e.target.value }))} placeholder="011-4xxx-xxxx" />
            </FormField>
          </div>
          {error && <div style={{ color: '#993C1D', fontSize: '13px', marginTop: '12px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} style={primaryBtn}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Drawer detalle */}
      {selectedProveedor && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <div onClick={() => setSelectedProveedor(null)} style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)',
          }} />
          <div style={{
            position: 'relative', width: '560px', height: '100vh',
            background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              padding: '20px 24px', borderBottom: '0.5px solid rgba(0,0,0,0.10)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>
                  {selectedProveedor.razon_social}
                </div>
                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                  {selectedProveedor.cuit} · {selectedProveedor.condicion_iva}
                </div>
              </div>
              <button onClick={() => setSelectedProveedor(null)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Datos del proveedor */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                {selectedProveedor.codigo_proveedor && (
                  <InfoItem label="Código" value={selectedProveedor.codigo_proveedor} />
                )}
                <InfoItem label="Categoría ARCA" value={selectedProveedor.categoria_arca || selectedProveedor.condicion_iva || '—'} />
                {selectedProveedor.cuenta_contable_nombre && (
                  <InfoItem label="Cuenta contable" value={selectedProveedor.cuenta_contable_nombre} />
                )}
                {selectedProveedor.banco && (
                  <InfoItem label="Banco" value={selectedProveedor.banco} />
                )}
                {selectedProveedor.cbu && (
                  <InfoItem label="CBU / Alias" value={`${selectedProveedor.cbu}${selectedProveedor.alias_cbu ? ` / ${selectedProveedor.alias_cbu}` : ''}`} />
                )}
                {selectedProveedor.direccion && (
                  <InfoItem label="Dirección" value={selectedProveedor.direccion} />
                )}
                <InfoItem label="Teléfono" value={selectedProveedor.telefono || '—'} />
                <InfoItem label="Email" value={selectedProveedor.email || '—'} />
                {selectedProveedor.servicio && (
                  <InfoItem label="Servicio" value={selectedProveedor.servicio} />
                )}
                <InfoItem label="Deuda pendiente" value={formatCurrency(selectedProveedor.deuda_total)} />
                {(selectedProveedor.drive_carpeta_anio || selectedProveedor.drive_carpeta) && (
                  <div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '500', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Carpeta Drive 2026</div>
                    <a href={selectedProveedor.drive_carpeta_anio || selectedProveedor.drive_carpeta} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#185fa5', textDecoration: 'none' }}>
                      <ExternalLink size={12} /> Abrir en Drive
                    </a>
                  </div>
                )}
              </div>

              {/* Facturas asociadas — tabla resumen */}
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
                Facturas asociadas ({detailFacturas.length})
              </div>
              {detailFacturas.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '24px' }}>Sin facturas registradas</div>
              ) : (
                <table className="data-table" style={{ marginBottom: '24px' }}>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailFacturas.map((f: any) => (
                      <tr key={f.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                          {f.tipo_comprobante}-{f.numero}
                        </td>
                        <td>{formatDate(f.fecha_emision)}</td>
                        <td>
                          <span className={`badge ${
                            f.estado === 'pagada' ? 'badge-green' :
                            f.estado === 'observada' ? 'badge-yellow' : 'badge-red'
                          }`}>
                            {f.estado === 'pendiente_pago' ? 'Pendiente' :
                             f.estado === 'pagada' ? 'Pagada' : 'Observada'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600' }}>
                          {formatCurrency(f.importe_total)}
                        </td>
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
                tipo="recibidas"
                onFacturaUpdated={(id, pdfPath) => {
                  setDetailFacturas(prev =>
                    prev.map((f: any) => f.id === id ? { ...f, pdf_path: pdfPath } : f)
                  );
                }}
              />

              {/* Portal de proveedores desactivado — Bloque B */}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
      <div style={{
        position: 'relative', background: 'white', borderRadius: '12px',
        padding: '28px', width: '560px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a2e' }}>{title}</div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children, colSpan }: { label: string; children: React.ReactNode; colSpan?: boolean }) {
  return (
    <div style={{ gridColumn: colSpan ? 'span 2' : undefined }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>{value}</div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: '#f7f8fa', border: '0.5px solid rgba(0,0,0,0.10)',
  borderRadius: '7px', width: '30px', height: '30px',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: '#6b7280',
};

const primaryBtn: React.CSSProperties = {
  background: '#185fa5', color: 'white', border: 'none',
  borderRadius: '8px', padding: '9px 20px', fontSize: '14px',
  fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
};

const cancelBtn: React.CSSProperties = {
  background: 'white', color: '#374151',
  border: '0.5px solid rgba(0,0,0,0.15)',
  borderRadius: '8px', padding: '9px 20px', fontSize: '14px',
  fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
};
