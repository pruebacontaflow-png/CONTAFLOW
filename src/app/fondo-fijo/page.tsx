"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Landmark, ArrowUp, ArrowDown, ChevronDown, ChevronUp, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const lbl: React.CSSProperties = { fontSize: 12, color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const primaryBtn: React.CSSProperties = { background: '#185fa5', color: 'white', border: 'none', borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 };
const cancelBtn: React.CSSProperties = { background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 7, padding: '8px 16px', fontSize: 13, cursor: 'pointer' };

const TIPOS_MOV = ['egreso', 'ingreso', 'reposicion', 'retiro_prestamo', 'ajuste'];
const emptyMov = { fecha: '', tipo: 'egreso', importe: '', descripcion: '', proyecto: '', area: '', comprobante_numero: '' };

function formatDate(s: string) { return s ? new Date(s + 'T00:00:00').toLocaleDateString('es-AR') : '—'; }
function formatMonto(m: number, moneda: string) {
  if (moneda === 'USD') return `USD ${Math.abs(m).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  return formatCurrency(Math.abs(m));
}

export default function FondoFijoPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [cajas, setCajas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [movimientos, setMovimientos] = useState<Record<number, any[]>>({});
  const [showMovForm, setShowMovForm] = useState<number | null>(null);
  const [movForm, setMovForm] = useState(emptyMov);
  const [saving, setSaving] = useState(false);

  const loadCajas = async () => {
    setLoading(true);
    const r = await fetch('/api/fondo-fijo/cajas').then(r => r.json());
    setCajas(r);
    setLoading(false);
  };

  useEffect(() => { loadCajas(); }, []);

  const toggleExpand = async (id: number) => {
    const next = !expanded[id];
    setExpanded(e => ({ ...e, [id]: next }));
    if (next && !movimientos[id]) {
      const r = await fetch(`/api/fondo-fijo/cajas/${id}/movimientos`).then(r => r.json());
      setMovimientos(m => ({ ...m, [id]: r }));
    }
  };

  const addMov = async (cajaId: number) => {
    if (!movForm.fecha || !movForm.importe) return;
    setSaving(true);
    const caja = cajas.find(c => c.id === cajaId);
    await fetch(`/api/fondo-fijo/cajas/${cajaId}/movimientos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...movForm, importe: parseFloat(movForm.importe), moneda: caja?.moneda }),
    });
    setSaving(false);
    setShowMovForm(null);
    setMovForm(emptyMov);
    const [r1, r2] = await Promise.all([
      fetch(`/api/fondo-fijo/cajas/${cajaId}/movimientos`).then(r => r.json()),
      fetch('/api/fondo-fijo/cajas').then(r => r.json()),
    ]);
    setMovimientos(m => ({ ...m, [cajaId]: r1 }));
    setCajas(r2);
  };

  const isIngreso = (tipo: string) => ['ingreso', 'reposicion'].includes(tipo);

  return (
    <AppLayout>
      <div style={{ padding: '32px 40px', maxWidth: 1100 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Fondo Fijo</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>Cajas chicas con movimientos, reposiciones y arqueo</p>
          </div>
        </div>

        {/* Resumen cajas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
          {cajas.map((caja: any) => (
            <div key={caja.id} style={{ background: 'white', borderRadius: 10, padding: 20, border: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => toggleExpand(caja.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Landmark size={18} color="#185fa5" />
                <span style={{ fontSize: 11, background: caja.moneda === 'USD' ? '#f0fdf4' : '#eff6ff', color: caja.moneda === 'USD' ? '#0F6E56' : '#185fa5', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>{caja.moneda}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{caja.nombre}</div>
              {caja.responsable && <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>{caja.responsable}</div>}
              <div style={{ fontSize: 22, fontWeight: 700, color: (caja.saldo_actual || 0) < 0 ? '#993C1D' : '#0F6E56' }}>
                {formatMonto(caja.saldo_actual || 0, caja.moneda)}
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>Cargando...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cajas.map((caja: any) => (
              <div key={caja.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => toggleExpand(caja.id)}>
                  <Landmark size={18} color="#185fa5" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{caja.nombre}</div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{caja.total_movimientos} movimientos · {caja.moneda}{caja.responsable ? ` · ${caja.responsable}` : ''}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: (caja.saldo_actual || 0) < 0 ? '#993C1D' : '#111827' }}>
                    {formatMonto(caja.saldo_actual || 0, caja.moneda)}
                  </div>
                  {isAdmin && (
                    <button style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#185fa5', display: 'flex', alignItems: 'center', gap: 4 }}
                      onClick={e => { e.stopPropagation(); setShowMovForm(caja.id); setMovForm(emptyMov); }}>
                      <Plus size={12} /> Movimiento
                    </button>
                  )}
                  {expanded[caja.id] ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
                </div>

                {showMovForm === caja.id && (
                  <div style={{ borderTop: '1px solid #f3f4f6', padding: 16, background: '#f9fafb' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, alignItems: 'end', marginBottom: 10 }}>
                      <div>
                        <label style={lbl}>Tipo</label>
                        <select style={inp} value={movForm.tipo} onChange={e => setMovForm(f => ({ ...f, tipo: e.target.value }))}>
                          {TIPOS_MOV.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                        </select>
                      </div>
                      <div><label style={lbl}>Fecha *</label><input type="date" style={inp} value={movForm.fecha} onChange={e => setMovForm(f => ({ ...f, fecha: e.target.value }))} /></div>
                      <div><label style={lbl}>Importe *</label><input type="number" style={inp} value={movForm.importe} onChange={e => setMovForm(f => ({ ...f, importe: e.target.value }))} /></div>
                      <div><label style={lbl}>Descripción</label><input style={inp} value={movForm.descripcion} onChange={e => setMovForm(f => ({ ...f, descripcion: e.target.value }))} /></div>
                      <div><label style={lbl}>Proyecto</label><input style={inp} value={movForm.proyecto} onChange={e => setMovForm(f => ({ ...f, proyecto: e.target.value }))} /></div>
                      <div><label style={lbl}>Área</label><input style={inp} value={movForm.area} onChange={e => setMovForm(f => ({ ...f, area: e.target.value }))} /></div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={primaryBtn} onClick={() => addMov(caja.id)} disabled={saving}>{saving ? '...' : 'Agregar'}</button>
                      <button style={cancelBtn} onClick={() => setShowMovForm(null)}>Cancelar</button>
                    </div>
                  </div>
                )}

                {expanded[caja.id] && (
                  <div style={{ borderTop: '1px solid #f3f4f6' }}>
                    {!movimientos[caja.id] ? (
                      <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Cargando...</p>
                    ) : movimientos[caja.id].length === 0 ? (
                      <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>Sin movimientos cargados — se cargarán en BLOQUE C</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Fecha</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Tipo</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Descripción</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Proyecto</th>
                            <th style={{ padding: '8px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Área</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Importe</th>
                            <th style={{ padding: '8px 16px', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimientos[caja.id].map((m: any) => (
                            <tr key={m.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '7px 16px' }}>{formatDate(m.fecha)}</td>
                              <td style={{ padding: '7px 16px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: isIngreso(m.tipo) ? '#0F6E56' : '#993C1D' }}>
                                  {isIngreso(m.tipo) ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                                  {m.tipo.replace('_', ' ')}
                                </span>
                              </td>
                              <td style={{ padding: '7px 16px', color: '#374151' }}>{m.descripcion || '—'}</td>
                              <td style={{ padding: '7px 16px', color: '#6b7280', fontSize: 12 }}>{m.proyecto || '—'}</td>
                              <td style={{ padding: '7px 16px', color: '#6b7280', fontSize: 12 }}>{m.area || '—'}</td>
                              <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: 600, color: isIngreso(m.tipo) ? '#0F6E56' : '#993C1D' }}>
                                {isIngreso(m.tipo) ? '+' : '-'}{formatMonto(m.importe, caja.moneda)}
                              </td>
                              <td style={{ padding: '7px 16px', textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{formatMonto(m.saldo_resultante, caja.moneda)}</td>
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
