"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

const MONEDAS = ["USD", "EUR", "BRL", "UYU"];

const emptyForm = { fecha: '', moneda: 'USD', compra: '', venta: '', fuente: 'Manual' };

export default function TipoCambioPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';

  const [tipos, setTipos] = useState<any[]>([]);
  const [monedaFilter, setMonedaFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    const url = `/api/tipos-cambio${monedaFilter ? `?moneda=${monedaFilter}` : ''}`;
    setTipos(await (await fetch(url)).json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [monedaFilter]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    const res = await fetch('/api/tipos-cambio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, compra: parseFloat(form.compra) || 0, venta: parseFloat(form.venta) || 0 }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ ...emptyForm });
      fetchData();
    } else {
      const j = await res.json();
      setError(j.error || 'Error al guardar');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este tipo de cambio?')) return;
    await fetch(`/api/tipos-cambio/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const fmt = (n: number) => n?.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) || '—';

  return (
    <AppLayout>
      {/* Topbar */}
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Tipo de Cambio</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={monedaFilter}
            onChange={e => setMonedaFilter(e.target.value)}
            style={{ padding: '5px 10px', fontSize: '13px', borderRadius: '7px', border: '0.5px solid #e5e7eb' }}
          >
            <option value="">Todas las monedas</option>
            {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {isAdmin && (
            <button className="btn-primary" onClick={() => { setForm({ ...emptyForm }); setError(''); setShowForm(true); }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={14} /> Nuevo tipo
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280' }}>Cargando...</div>
        ) : tipos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
            Sin tipos de cambio cargados. Usá el botón "Nuevo tipo" para agregar.
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Moneda</th>
                  <th style={{ textAlign: 'right' }}>Compra</th>
                  <th style={{ textAlign: 'right' }}>Venta</th>
                  <th>Fuente</th>
                  {isAdmin && <th style={{ width: '48px' }}></th>}
                </tr>
              </thead>
              <tbody>
                {tipos.map((t: any) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.fecha)}</td>
                    <td>
                      <span style={{ fontWeight: '600', color: '#185fa5', background: '#e8f0fa', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                        {t.moneda}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '13px' }}>${fmt(t.compra)}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '13px' }}>${fmt(t.venta)}</td>
                    <td style={{ color: '#6b7280', fontSize: '12px' }}>{t.fuente || '—'}</td>
                    {isAdmin && (
                      <td>
                        <button onClick={() => handleDelete(t.id)} title="Eliminar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#993C1D', padding: '4px' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer: Nuevo tipo de cambio */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '400px', background: 'white', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid rgba(0,0,0,0.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: '600' }}>Nuevo tipo de cambio</div>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={18} /></button>
            </div>
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Fecha</label>
                <input type="date" className="form-input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Moneda</label>
                <select className="form-input" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Compra (ARS)</label>
                  <input type="number" className="form-input" value={form.compra} onChange={e => setForm(f => ({ ...f, compra: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
                <div>
                  <label className="form-label">Venta (ARS)</label>
                  <input type="number" className="form-input" value={form.venta} onChange={e => setForm(f => ({ ...f, venta: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
              </div>
              <div>
                <label className="form-label">Fuente</label>
                <input type="text" className="form-input" value={form.fuente} onChange={e => setForm(f => ({ ...f, fuente: e.target.value }))} placeholder="BCRA, Dólar Blue, Manual..." />
              </div>
              {error && <div style={{ color: '#993C1D', fontSize: '13px', background: '#f9ece7', padding: '10px 14px', borderRadius: '8px' }}>{error}</div>}
            </div>
            <div style={{ padding: '16px 24px', borderTop: '0.5px solid rgba(0,0,0,0.10)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
