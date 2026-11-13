"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, History, Building2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const TIPOS = ['Cuenta Corriente', 'Caja de Ahorro', 'Cuenta Comitente', 'Otro'];
const MONEDAS = ['ARS', 'USD', 'EUR'];
const emptyForm = { banco: '', tipo: 'Cuenta Corriente', moneda: 'ARS', saldo_actual: '' };

export default function BancosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [cuentas, setCuentas] = useState<any[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showHistorial, setShowHistorial] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch('/api/bancos');
    const data = await res.json();
    setCuentas(data.cuentas || []);
    setHistorial(data.historial || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = editId ? `/api/bancos/${editId}` : '/api/bancos';
    const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...form, saldo_actual: parseFloat(form.saldo_actual) || 0 }) });
    if (!res.ok) { const e = await res.json(); setError(e.error || 'Error'); }
    else { setShowForm(false); fetchData(); }
    setSaving(false);
  };

  const totalARS = cuentas.filter(c => c.moneda === 'ARS').reduce((a, c) => a + c.saldo_actual, 0);
  const totalUSD = cuentas.filter(c => c.moneda === 'USD').reduce((a, c) => a + c.saldo_actual, 0);

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Saldos Bancarios</div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setShowHistorial(true)} style={{ ...cancelBtn, display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}>
            <History size={14} /> Historial
          </button>
          {isAdmin && (
            <button onClick={() => { setForm({...emptyForm}); setEditId(null); setError(''); setShowForm(true); }} style={primaryBtn}>
              <Plus size={15} /> Nueva cuenta
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Totales */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px 24px', border: '0.5px solid rgba(0,0,0,0.10)', minWidth: '200px' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Total ARS</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: '#0F6E56' }}>{formatCurrency(totalARS)}</div>
          </div>
          {totalUSD > 0 && (
            <div style={{ background: 'white', borderRadius: '12px', padding: '18px 24px', border: '0.5px solid rgba(0,0,0,0.10)', minWidth: '200px' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Total USD</div>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#185fa5' }}>USD {new Intl.NumberFormat('es-AR').format(totalUSD)}</div>
            </div>
          )}
          <div style={{ background: 'white', borderRadius: '12px', padding: '18px 24px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Cuentas activas</div>
            <div style={{ fontSize: '26px', fontWeight: '700', color: '#1a1a2e' }}>{cuentas.length}</div>
          </div>
        </div>

        {/* Grid de cuentas */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>Cargando...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {cuentas.map(c => (
              <div key={c.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#e8f0fa', borderRadius: '8px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Building2 size={18} color="#185fa5" />
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{c.banco}</div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{c.tipo}</div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => { setForm({ banco: c.banco, tipo: c.tipo, moneda: c.moneda, saldo_actual: String(c.saldo_actual) }); setEditId(c.id); setError(''); setShowForm(true); }} style={iconBtn}><Edit2 size={13} /></button>
                      <button onClick={async () => { if (confirm('¿Eliminar cuenta?')) { await fetch(`/api/bancos/${c.id}`, {method:'DELETE'}); fetchData(); } }} style={{ ...iconBtn, color: '#993C1D' }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: c.saldo_actual >= 0 ? '#0F6E56' : '#993C1D' }}>
                  {c.moneda === 'USD' ? `USD ${new Intl.NumberFormat('es-AR').format(c.saldo_actual)}` : formatCurrency(c.saldo_actual)}
                </div>
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                  Actualizado: {formatDate(c.updated_at?.split('T')[0] || c.updated_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '28px', width: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{editId ? 'Editar cuenta' : 'Nueva cuenta bancaria'}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Banco *</label>
                <input value={form.banco} onChange={(e) => setForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ej: Banco Nación" />
              </div>
              <div>
                <label style={labelStyle}>Tipo de cuenta</label>
                <select value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Moneda</label>
                <select value={form.moneda} onChange={(e) => setForm(f => ({ ...f, moneda: e.target.value }))}>
                  {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Saldo actual</label>
                <input type="number" value={form.saldo_actual} onChange={(e) => setForm(f => ({ ...f, saldo_actual: e.target.value }))} placeholder="0.00" />
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

      {/* Historial drawer */}
      {showHistorial && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}>
          <div onClick={() => setShowHistorial(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }} />
          <div style={{ position: 'relative', width: '480px', height: '100vh', background: 'white', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '0.5px solid rgba(0,0,0,0.10)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>Historial de actualizaciones</div>
              <button onClick={() => setShowHistorial(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {historial.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: '13px' }}>Sin historial</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Cuenta</th><th>Anterior</th><th>Nuevo</th></tr></thead>
                  <tbody>
                    {historial.map((h: any) => (
                      <tr key={h.id}>
                        <td style={{ fontSize: '12px' }}>{formatDate(h.fecha)}</td>
                        <td style={{ fontSize: '12px' }}>{h.banco} · {h.tipo}</td>
                        <td style={{ textAlign: 'right', fontSize: '12px', color: '#9ca3af' }}>{formatCurrency(h.saldo_anterior)}</td>
                        <td style={{ textAlign: 'right', fontSize: '12px', fontWeight: '600', color: h.saldo_nuevo >= h.saldo_anterior ? '#0F6E56' : '#993C1D' }}>{formatCurrency(h.saldo_nuevo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
