"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, X, Users } from "lucide-react";

const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { background: '#185fa5', color: 'white', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const cancelBtn: React.CSSProperties = { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer' };

const empty = { nombre: '', proveedor_id: '', zona: '' };

export default function ComercialComerciales() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [items, setItems] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      fetch('/api/comerciales').then(r => r.json()),
      fetch('/api/proveedores').then(r => r.json()),
    ]);
    setItems(r1);
    setProveedores(r2);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = (item: any) => {
    setForm({ nombre: item.nombre, proveedor_id: item.proveedor_id ?? '', zona: item.zona ?? '' });
    setEditId(item.id);
    setError('');
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nombre.trim()) { setError('Nombre requerido'); return; }
    setSaving(true); setError('');
    const url = editId ? `/api/comerciales/${editId}` : '/api/comerciales';
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, proveedor_id: form.proveedor_id || null }) });
    setSaving(false);
    if (!res.ok) { setError('Error al guardar'); return; }
    setShowForm(false);
    load();
  };

  return (
    <AppLayout>
      <div style={{ padding: '32px 40px', maxWidth: 900 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Comerciales</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Equipo comercial — asociados a proveedores (Liquidación de Comisiones)</p>
          </div>
          {isAdmin && (
            <button style={primaryBtn} onClick={openNew}>
              <Plus size={15} /> Nuevo comercial
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{editId ? 'Editar comercial' : 'Nuevo comercial'}</span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={lbl}>Nombre *</label>
                <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Proveedor (para comisiones)</label>
                <select style={inp} value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">— Sin vincular —</option>
                  {proveedores.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.razon_social}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Zona (completar)</label>
                <input style={inp} value={form.zona} onChange={e => setForm(f => ({ ...f, zona: e.target.value }))} placeholder="A completar" />
              </div>
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
        ) : (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Proveedor vinculado</th>
                  <th>CUIT</th>
                  <th>Zona</th>
                  {isAdmin && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: '#9ca3af' }}>
                    <Users size={32} style={{ marginBottom: 8, opacity: 0.3 }} /><br />Sin comerciales
                  </td></tr>
                )}
                {items.map((it: any) => (
                  <tr key={it.id}>
                    <td style={{ fontWeight: 600 }}>{it.nombre}</td>
                    <td>{it.proveedor_razon_social || <span style={{ color: '#9ca3af' }}>Sin vincular</span>}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{it.proveedor_cuit || '—'}</td>
                    <td>{it.zona || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>a completar</span>}</td>
                    {isAdmin && (
                      <td>
                        <button onClick={() => openEdit(it)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#185fa5' }}>
                          <Edit2 size={14} />
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
    </AppLayout>
  );
}
