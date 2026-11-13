"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, X, Edit2, Trash2, Calendar, AlertTriangle, Check, List, ChevronLeft, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate, getDiasHastaVencimiento, getColorVencimiento } from "@/lib/utils";

const emptyForm = { descripcion: '', fecha_vencimiento: '', importe: '', estado: 'pendiente' };

export default function VencimientosPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === 'admin';
  const [vencimientos, setVencimientos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [incluirPagados, setIncluirPagados] = useState(false);
  const [vista, setVista] = useState<'lista'|'calendario'>('lista');
  const [calMes, setCalMes] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [calDiaSeleccionado, setCalDiaSeleccionado] = useState<string|null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch(`/api/vencimientos?incluirPagados=${incluirPagados}`);
    setVencimientos(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [incluirPagados]);

  const handleSave = async () => {
    setSaving(true);
    const url = editId ? `/api/vencimientos/${editId}` : '/api/vencimientos';
    const res = await fetch(url, { method: editId ? 'PUT' : 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...form, importe: parseFloat(form.importe) || 0 }) });
    if (res.ok) { setShowForm(false); fetchData(); }
    setSaving(false);
  };

  const marcarPagado = async (id: number, v: any) => {
    if (v.tipo !== 'fiscal') return;
    await fetch(`/api/vencimientos/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ ...v, estado: 'pagado' }) });
    fetchData();
  };

  const stats = {
    vencidos: vencimientos.filter(v => getDiasHastaVencimiento(v.fecha_vencimiento) < 0).length,
    urgentes: vencimientos.filter(v => { const d = getDiasHastaVencimiento(v.fecha_vencimiento); return d >= 0 && d <= 7; }).length,
    proximos: vencimientos.filter(v => { const d = getDiasHastaVencimiento(v.fecha_vencimiento); return d > 7 && d <= 30; }).length,
    totalPendiente: vencimientos.reduce((a, v) => a + (v.importe || 0), 0),
  };

  const colorMap = { green: { bg: '#e6f4f0', text: '#0F6E56', label: 'Al día' }, yellow: { bg: '#fef3e2', text: '#854F0B', label: 'Próximo' }, red: { bg: '#f9ece7', text: '#993C1D', label: 'Urgente/Vencido' } };

  return (
    <AppLayout>
      <div style={{ background: 'white', borderBottom: '0.5px solid rgba(0,0,0,0.10)', padding: '0 28px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600' }}>Vencimientos</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', cursor: 'pointer' }}>
            <input type="checkbox" checked={incluirPagados} onChange={(e) => setIncluirPagados(e.target.checked)} />
            Incluir pagados
          </label>
          <div style={{ display: 'flex', border: '0.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setVista('lista')}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', border: 'none', cursor: 'pointer', background: vista === 'lista' ? '#185fa5' : 'white', color: vista === 'lista' ? 'white' : '#6b7280', fontWeight: '600', fontFamily: 'inherit' }}
            ><List size={13} /> Lista</button>
            <button
              onClick={() => setVista('calendario')}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', fontSize: '12px', border: 'none', cursor: 'pointer', background: vista === 'calendario' ? '#185fa5' : 'white', color: vista === 'calendario' ? 'white' : '#6b7280', fontWeight: '600', fontFamily: 'inherit' }}
            ><Calendar size={13} /> Calendario</button>
          </div>
          {isAdmin && (
            <button onClick={() => { setForm({...emptyForm}); setEditId(null); setShowForm(true); }} style={primaryBtn}>
              <Plus size={15} /> Nuevo vencimiento
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 28px', flex: 1 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Vencidos', val: stats.vencidos, color: '#993C1D', bg: '#f9ece7' },
            { label: 'Próximos 7 días', val: stats.urgentes, color: '#854F0B', bg: '#fef3e2' },
            { label: 'Próximos 30 días', val: stats.proximos, color: '#185fa5', bg: '#e8f0fa' },
            { label: 'Total a pagar', val: formatCurrency(stats.totalPendiente), color: '#0F6E56', bg: '#e6f4f0', isCurrency: true },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', border: '0.5px solid rgba(0,0,0,0.10)' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>{s.label}</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: s.color }}>{s.isCurrency ? s.val : s.val}</div>
            </div>
          ))}
        </div>

        {vista === 'lista' ? (
          /* Tabla */
          <div style={{ background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Cargando...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Alerta</th><th>Descripción</th><th>Tipo</th><th>Fecha</th><th>Días</th><th>Estado</th><th style={{ textAlign: 'right' }}>Importe</th><th></th></tr>
                </thead>
                <tbody>
                  {vencimientos.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#9ca3af' }}>Sin vencimientos</td></tr>
                  ) : vencimientos.map((v) => {
                    const dias = getDiasHastaVencimiento(v.fecha_vencimiento);
                    const col = v.estado === 'pagado' ? 'green' : getColorVencimiento(dias);
                    const c = colorMap[col];
                    return (
                      <tr key={`${v.tipo}-${v.id}`}>
                        <td><div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c.text }} /></td>
                        <td style={{ fontWeight: '500' }}>
                          {v.tipo === 'factura_recibida' ? `${v.descripcion} · ${v.tipo_comprobante}-${v.numero}` : v.descripcion}
                        </td>
                        <td>
                          <span className={`badge ${v.tipo === 'fiscal' ? 'badge-blue' : 'badge-gray'}`}>
                            {v.tipo === 'fiscal' ? 'Fiscal' : 'Factura'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px' }}>{formatDate(v.fecha_vencimiento)}</td>
                        <td>
                          <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>
                            {v.estado === 'pagado' ? 'Pagado' : dias < 0 ? `Venció hace ${Math.abs(dias)}d` : `${dias}d`}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${v.estado === 'pagado' ? 'badge-green' : 'badge-yellow'}`}>
                            {v.estado === 'pagado' ? 'Pagado' : 'Pendiente'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '700', color: v.estado === 'pagado' ? '#9ca3af' : '#993C1D' }}>
                          {v.importe > 0 ? formatCurrency(v.importe) : '—'}
                        </td>
                        <td>
                          {isAdmin && v.tipo === 'fiscal' && v.estado !== 'pagado' && (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                              <button onClick={() => marcarPagado(v.id, v)} style={{ ...iconBtn, background: '#e6f4f0', color: '#0F6E56' }} title="Marcar como pagado"><Check size={13} /></button>
                              <button onClick={() => { setForm({ descripcion: v.descripcion, fecha_vencimiento: v.fecha_vencimiento, importe: String(v.importe), estado: v.estado }); setEditId(v.id); setShowForm(true); }} style={iconBtn}><Edit2 size={13} /></button>
                              <button onClick={async () => { if (confirm('¿Eliminar?')) { await fetch(`/api/vencimientos/${v.id}`, {method:'DELETE'}); fetchData(); } }} style={{ ...iconBtn, color: '#993C1D' }}><Trash2 size={13} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Calendario */
          <CalendarioVencimientos
            vencimientos={vencimientos}
            calMes={calMes}
            setCalMes={setCalMes}
            calDiaSeleccionado={calDiaSeleccionado}
            setCalDiaSeleccionado={setCalDiaSeleccionado}
            colorMap={colorMap}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            getDiasHastaVencimiento={getDiasHastaVencimiento}
            getColorVencimiento={getColorVencimiento}
          />
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowForm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'relative', background: 'white', borderRadius: '12px', padding: '28px', width: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '16px', fontWeight: '700' }}>{editId ? 'Editar vencimiento' : 'Nuevo vencimiento fiscal'}</div>
              <button onClick={() => setShowForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Descripción *</label>
                <input value={form.descripcion} onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Ej: IVA Período Mayo 2026" />
              </div>
              <div>
                <label style={labelStyle}>Fecha de vencimiento *</label>
                <input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Importe estimado</label>
                <input type="number" value={form.importe} onChange={(e) => setForm(f => ({ ...f, importe: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label style={labelStyle}>Estado</label>
                <select value={form.estado} onChange={(e) => setForm(f => ({ ...f, estado: e.target.value }))}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={primaryBtn}>{saving ? 'Guardando...' : 'Guardar'}</button>
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

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function CalendarioVencimientos({ vencimientos, calMes, setCalMes, calDiaSeleccionado, setCalDiaSeleccionado, colorMap, formatCurrency, formatDate, getDiasHastaVencimiento, getColorVencimiento }: any) {
  const { year, month } = calMes;

  const primerDia = new Date(year, month, 1).getDay();
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  // Mapa día ISO → vencimientos
  const porDia: Record<string, any[]> = {};
  for (const v of vencimientos) {
    const fecha = v.fecha_vencimiento?.slice(0, 10);
    if (!fecha) continue;
    if (!porDia[fecha]) porDia[fecha] = [];
    porDia[fecha].push(v);
  }

  const prevMes = () => setCalMes((m: any) => m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 });
  const nextMes = () => setCalMes((m: any) => m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 });

  const hoyStr = new Date().toISOString().slice(0, 10);
  const selItems = calDiaSeleccionado ? (porDia[calDiaSeleccionado] || []) : [];

  const celdas: (number | null)[] = [...Array(primerDia).fill(null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];
  while (celdas.length % 7 !== 0) celdas.push(null);

  return (
    <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ flex: 1, background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', padding: '20px' }}>
        {/* Nav mes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <button onClick={prevMes} style={{ ...iconBtn }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1a1a2e' }}>{MESES_ES[month]} {year}</span>
          <button onClick={nextMes} style={{ ...iconBtn }}><ChevronRight size={16} /></button>
        </div>
        {/* Días semana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
          {DIAS_SEMANA.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#9ca3af', padding: '4px 0' }}>{d}</div>
          ))}
        </div>
        {/* Grid días */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
          {celdas.map((dia, i) => {
            if (!dia) return <div key={i} />;
            const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
            const items = porDia[isoDate] || [];
            const esHoy = isoDate === hoyStr;
            const esSel = isoDate === calDiaSeleccionado;
            const colores = items.map(v => {
              const dias = getDiasHastaVencimiento(v.fecha_vencimiento);
              return v.estado === 'pagado' ? '#0F6E56' : getColorVencimiento(dias) === 'red' ? '#993C1D' : getColorVencimiento(dias) === 'yellow' ? '#854F0B' : '#0F6E56';
            });
            return (
              <div
                key={i}
                onClick={() => items.length > 0 ? setCalDiaSeleccionado(esSel ? null : isoDate) : null}
                style={{
                  borderRadius: '8px',
                  padding: '6px 4px',
                  minHeight: '48px',
                  background: esSel ? '#e8f0fa' : esHoy ? '#f0f7ff' : 'transparent',
                  border: esHoy ? '1.5px solid #185fa5' : esSel ? '1.5px solid #185fa5' : '0.5px solid transparent',
                  cursor: items.length > 0 ? 'pointer' : 'default',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: esHoy ? '700' : '400', color: esHoy ? '#185fa5' : '#374151' }}>{dia}</span>
                {items.length > 0 && (
                  <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {colores.slice(0, 3).map((c, ci) => (
                      <div key={ci} style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
                    ))}
                    {items.length > 3 && <span style={{ fontSize: '9px', color: '#6b7280' }}>+{items.length - 3}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel lateral - día seleccionado */}
      {calDiaSeleccionado && selItems.length > 0 && (
        <div style={{ width: '300px', background: 'white', borderRadius: '12px', border: '0.5px solid rgba(0,0,0,0.10)', padding: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a2e', marginBottom: '12px' }}>
            {formatDate(calDiaSeleccionado)} · {selItems.length} vencimiento{selItems.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selItems.map((v: any, i: number) => {
              const dias = getDiasHastaVencimiento(v.fecha_vencimiento);
              const col = v.estado === 'pagado' ? 'green' : getColorVencimiento(dias);
              const c = colorMap[col];
              return (
                <div key={i} style={{ padding: '10px 12px', borderRadius: '8px', border: `0.5px solid ${c.text}30`, background: c.bg }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#1a1a2e', marginBottom: '3px' }}>
                    {v.tipo === 'factura_recibida' ? `${v.descripcion} · ${v.tipo_comprobante}-${v.numero}` : v.descripcion}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', background: c.text + '20', color: c.text, padding: '2px 6px', borderRadius: '8px', fontWeight: '600' }}>
                      {v.tipo === 'fiscal' ? 'Fiscal' : 'Factura'}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: c.text }}>
                      {v.importe > 0 ? formatCurrency(v.importe) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
