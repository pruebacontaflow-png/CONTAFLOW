"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, TrendingUp, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { background: '#185fa5', color: 'white', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const cancelBtn: React.CSSProperties = { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer' };

const TIPOS = ['plazo_fijo', 'fci', 'bono', 'accion', 'criptomoneda', 'otro'];
const empty = { nombre: '', tipo: 'plazo_fijo', entidad: '', moneda: 'ARS', tasa_nominal: '', fecha_inicio: '', fecha_vencimiento: '', observaciones: '' };

export default function InversionesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/inversiones').then(r => r.json());
    setItems(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.nombre.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const res = await fetch('/api/inversiones', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tasa_nominal: parseFloat(form.tasa_nominal) || 0 }),
    });
    setSaving(false);
    if (!res.ok) { setError('Error al guardar'); return; }
    setShowForm(false); setForm(empty); load();
  };

  const totalARS = items.filter(i => i.moneda === 'ARS').reduce((s: number, i: any) => s + (i.saldo_actual || 0), 0);
  const totalUSD = items.filter(i => i.moneda === 'USD').reduce((s: number, i: any) => s + (i.saldo_actual || 0), 0);

  return (
    <AppLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Inversiones</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Plazos fijos, FCI y otros instrumentos financieros</p>
          </div>
          {isAdmin && (
            <button style={primaryBtn} onClick={() => { setForm(empty); setError(''); setShowForm(true); }}>
              <Plus size={15} /> Nueva inversión
            </button>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Total ARS', value: formatCurrency(totalARS), color: '#185fa5' },
            { label: 'Total USD', value: `USD ${totalUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`, color: '#0F6E56' },
            { label: 'Instrumentos activos', value: items.filter(i => i.estado === 'activa').length.toString(), color: '#854F0B' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background: 'white', borderRadius: 10, padding: 20, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{kpi.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>Nueva inversión</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, marginBottom: 12 }}>
              <div><label style={lbl}>Nombre *</label><input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div><label style={lbl}>Tipo</label>
                <select style={inp} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Moneda</label>
                <select style={inp} value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
              <div><label style={lbl}>Tasa nominal %</label><input type="number" style={inp} value={form.tasa_nominal} onChange={e => setForm(f => ({ ...f, tasa_nominal: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div><label style={lbl}>Entidad</label><input style={inp} value={form.entidad} onChange={e => setForm(f => ({ ...f, entidad: e.target.value }))} placeholder="Banco, fondo, etc." /></div>
              <div><label style={lbl}>Fecha inicio</label><input type="date" style={inp} value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} /></div>
              <div><label style={lbl}>Vencimiento</label><input type="date" style={inp} value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} /></div>
            </div>
            {error && <p style={{ color: '#993C1D', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={primaryBtn} onClick={save} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button style={cancelBtn} onClick={() => setShowForm(false)}>Cancelar</button>
            </div>
          </div>
        )}

        {loading ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>
        ) : items.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: 48, textAlign: 'center', color: '#9ca3af' }}>
            <TrendingUp size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin datos</div>
            <div style={{ fontSize: 13 }}>Las inversiones se cargarán próximamente</div>
          </div>
        ) : (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nombre</th><th>Tipo</th><th>Entidad</th><th>Moneda</th>
                  <th style={{ textAlign: 'right' }}>Saldo</th><th>Tasa</th><th>Vencimiento</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.id}>
                    <td style={{ fontWeight: 600 }}>{it.nombre}</td>
                    <td><span className="badge-blue">{it.tipo.replace('_', ' ')}</span></td>
                    <td>{it.entidad || '—'}</td>
                    <td>{it.moneda}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.moneda === 'ARS' ? formatCurrency(it.saldo_actual) : `USD ${(it.saldo_actual || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`}</td>
                    <td>{it.tasa_nominal ? `${it.tasa_nominal}%` : '—'}</td>
                    <td>{it.fecha_vencimiento ? new Date(it.fecha_vencimiento).toLocaleDateString('es-AR') : '—'}</td>
                    <td><span className={it.estado === 'activa' ? 'badge-green' : 'badge-gray'}>{it.estado}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
