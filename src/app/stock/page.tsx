"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Package, ChevronDown, ChevronUp, ArrowUp, ArrowDown, X } from "lucide-react";

const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { background: '#185fa5', color: 'white', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const cancelBtn: React.CSSProperties = { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer' };

const emptyMov = { fecha: '', tipo: 'egreso', cantidad: '', destino: '', observaciones: '' };

export default function StockPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [movimientos, setMovimientos] = useState<Record<number, any[]>>({});
  const [showMovForm, setShowMovForm] = useState<number | null>(null);
  const [movForm, setMovForm] = useState(emptyMov);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch('/api/stock').then(r => r.json());
    setProductos(r);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleExpand = async (id: number) => {
    const next = !expanded[id];
    setExpanded(e => ({ ...e, [id]: next }));
    if (next && !movimientos[id]) {
      const r = await fetch(`/api/stock/${id}/movimientos`).then(r => r.json());
      setMovimientos(m => ({ ...m, [id]: r }));
    }
  };

  const addMov = async (prodId: number) => {
    if (!movForm.fecha || !movForm.cantidad) return;
    setSaving(true);
    await fetch(`/api/stock/${prodId}/movimientos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...movForm, cantidad: parseFloat(movForm.cantidad) }),
    });
    setSaving(false);
    setShowMovForm(null);
    setMovForm(emptyMov);
    // Reload movimientos and products
    const [r1, r2] = await Promise.all([
      fetch(`/api/stock/${prodId}/movimientos`).then(r => r.json()),
      fetch('/api/stock').then(r => r.json()),
    ]);
    setMovimientos(m => ({ ...m, [prodId]: r1 }));
    setProductos(r2);
  };

  const formatDate = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—';

  return (
    <AppLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Stock</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Control de inventario de productos físicos</p>
          </div>
        </div>

        {loading ? <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {productos.map((prod: any) => (
              <div key={prod.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => toggleExpand(prod.id)}>
                  <Package size={20} color="#185fa5" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{prod.nombre}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{prod.codigo ? `Cód: ${prod.codigo} · ` : ''}{prod.total_movimientos} movimientos</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: prod.stock_actual <= (prod.stock_minimo || 0) ? '#993C1D' : '#0F6E56' }}>{prod.stock_actual}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{prod.unidad}</div>
                  </div>
                  {isAdmin && (
                    <button
                      style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#185fa5', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={e => { e.stopPropagation(); setShowMovForm(prod.id); setMovForm(emptyMov); }}
                    >
                      <Plus size={12} /> Movimiento
                    </button>
                  )}
                  {expanded[prod.id] ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
                </div>

                {/* New movement form */}
                {showMovForm === prod.id && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: 16, background: '#f9fafb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 2fr', gap: 12, alignItems: 'end' }}>
                      <div>
                        <label style={lbl}>Tipo</label>
                        <select style={{ ...inp, width: 100 }} value={movForm.tipo} onChange={e => setMovForm(f => ({ ...f, tipo: e.target.value }))}>
                          <option value="egreso">Egreso</option>
                          <option value="ingreso">Ingreso</option>
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Fecha *</label>
                        <input type="date" style={inp} value={movForm.fecha} onChange={e => setMovForm(f => ({ ...f, fecha: e.target.value }))} />
                      </div>
                      <div>
                        <label style={lbl}>Cantidad *</label>
                        <input type="number" style={inp} value={movForm.cantidad} onChange={e => setMovForm(f => ({ ...f, cantidad: e.target.value }))} />
                      </div>
                      <div>
                        <label style={lbl}>Destino / Observación</label>
                        <input style={inp} value={movForm.destino} onChange={e => setMovForm(f => ({ ...f, destino: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button style={primaryBtn} onClick={() => addMov(prod.id)} disabled={saving}>{saving ? '...' : 'Agregar'}</button>
                      <button style={cancelBtn} onClick={() => setShowMovForm(null)}>Cancelar</button>
                    </div>
                  </div>
                )}

                {/* Movimientos table */}
                {expanded[prod.id] && (
                  <div style={{ borderTop: '1px solid #f3f4f6' }}>
                    {!movimientos[prod.id] ? (
                      <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Cargando...</p>
                    ) : movimientos[prod.id].length === 0 ? (
                      <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Sin movimientos</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Fecha</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Tipo</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Cantidad</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Stock resultante</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Destino</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientos[prod.id].map((m: any) => (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '7px 16px' }}>{formatDate(m.fecha)}</td>
                              <td style={{ padding: '7px 16px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: m.tipo === 'ingreso' ? '#0F6E56' : '#993C1D' }}>
                                  {m.tipo === 'ingreso' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                  {m.tipo}
                                </span>
                              </td>
                              <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 600, color: m.tipo === 'ingreso' ? '#0F6E56' : '#993C1D' }}>
                                {m.tipo === 'ingreso' ? '+' : '-'}{m.cantidad}
                              </td>
                              <td style={{ padding: '7px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{m.stock_resultante}</td>
                              <td style={{ padding: '7px 16px', color: '#6b7280' }}>{m.destino || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
