"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { Plus, Edit2, Trash2, X, Search, CreditCard } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const emptyCard = { banco: "", numero_ultimos4: "", titular: "", limite: "", moneda: "ARS", activa: true, notas: "" };
const emptyGasto = { tarjeta_id: "", fecha: "", comercio: "", importe: "", moneda: "ARS", categoria: "", notas: "" };

export default function TarjetaCorporativaPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [tarjetas, setTarjetas] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [selTarjeta, setSelTarjeta] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [showCardForm, setShowCardForm] = useState(false);
  const [showGastoForm, setShowGastoForm] = useState(false);
  const [editCardId, setEditCardId] = useState<number | null>(null);
  const [editGastoId, setEditGastoId] = useState<number | null>(null);
  const [cardForm, setCardForm] = useState({ ...emptyCard });
  const [gastoForm, setGastoForm] = useState({ ...emptyGasto });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchTarjetas = async () => {
    setTarjetas(await (await fetch("/api/tarjetas-corporativas")).json());
  };
  const fetchGastos = async (tarjetaId?: number) => {
    const qs = tarjetaId ? `?tarjeta_id=${tarjetaId}&search=${search}` : `?search=${search}`;
    setGastos(await (await fetch(`/api/gastos-tarjeta${qs}`)).json());
  };

  useEffect(() => { fetchTarjetas(); }, []);
  useEffect(() => { fetchGastos(selTarjeta?.id); }, [selTarjeta, search]);

  const openEditCard = (t: any) => {
    setCardForm({ banco: t.banco, numero_ultimos4: t.numero_ultimos4, titular: t.titular, limite: String(t.limite || ""), moneda: t.moneda, activa: t.activa === 1, notas: t.notas || "" });
    setEditCardId(t.id); setError(""); setShowCardForm(true);
  };

  const handleSaveCard = async () => {
    setSaving(true); setError("");
    const url = editCardId ? `/api/tarjetas-corporativas/${editCardId}` : "/api/tarjetas-corporativas";
    const res = await fetch(url, { method: editCardId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cardForm, limite: parseFloat(cardForm.limite) || 0, activa: cardForm.activa ? 1 : 0 }) });
    if (res.ok) { setShowCardForm(false); fetchTarjetas(); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDeleteCard = async (id: number) => {
    if (!confirm("¿Eliminar esta tarjeta?")) return;
    await fetch(`/api/tarjetas-corporativas/${id}`, { method: "DELETE" });
    if (selTarjeta?.id === id) setSelTarjeta(null);
    fetchTarjetas();
  };

  const openCreateGasto = () => {
    setGastoForm({ ...emptyGasto, tarjeta_id: selTarjeta ? String(selTarjeta.id) : "", fecha: new Date().toISOString().split("T")[0] });
    setEditGastoId(null); setError(""); setShowGastoForm(true);
  };
  const openEditGasto = (g: any) => {
    setGastoForm({ tarjeta_id: String(g.tarjeta_id), fecha: g.fecha, comercio: g.comercio, importe: String(g.importe), moneda: g.moneda, categoria: g.categoria || "", notas: g.notas || "" });
    setEditGastoId(g.id); setError(""); setShowGastoForm(true);
  };

  const handleSaveGasto = async () => {
    setSaving(true); setError("");
    const url = editGastoId ? `/api/gastos-tarjeta/${editGastoId}` : "/api/gastos-tarjeta";
    const res = await fetch(url, { method: editGastoId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gastoForm, importe: parseFloat(gastoForm.importe) || 0, tarjeta_id: parseInt(gastoForm.tarjeta_id) }) });
    if (res.ok) { setShowGastoForm(false); fetchGastos(selTarjeta?.id); } else { const j = await res.json(); setError(j.error || "Error"); }
    setSaving(false);
  };

  const handleDeleteGasto = async (id: number) => {
    if (!confirm("¿Eliminar este gasto?")) return;
    await fetch(`/api/gastos-tarjeta/${id}`, { method: "DELETE" });
    fetchGastos(selTarjeta?.id);
  };

  const totalGastos = gastos.reduce((a, g) => a + g.importe, 0);

  return (
    <AppLayout>
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Tarjetas Corporativas</div>
        {isAdmin && (
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={openCreateGasto} style={{ ...primaryBtn, background: "#0F6E56" }}><Plus size={14} /> Nuevo gasto</button>
            <button onClick={() => { setCardForm({ ...emptyCard }); setEditCardId(null); setError(""); setShowCardForm(true); }} style={primaryBtn}><CreditCard size={14} /> Nueva tarjeta</button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Panel izquierdo - tarjetas */}
        <div style={{ width: "260px", borderRight: "0.5px solid rgba(0,0,0,0.10)", overflowY: "auto", background: "#f9fafb", flexShrink: 0 }}>
          <div style={{ padding: "16px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", fontSize: "11px", fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Tarjetas</div>
          <div
            onClick={() => setSelTarjeta(null)}
            style={{ padding: "12px 14px", cursor: "pointer", background: !selTarjeta ? "#e8f0fb" : "transparent", borderLeft: !selTarjeta ? "3px solid #185fa5" : "3px solid transparent", fontWeight: "600", fontSize: "13px", color: "#374151" }}
          >
            Todos los gastos
          </div>
          {tarjetas.map(t => (
            <div key={t.id} onClick={() => setSelTarjeta(t)} style={{ padding: "12px 14px", cursor: "pointer", background: selTarjeta?.id === t.id ? "#e8f0fb" : "transparent", borderLeft: selTarjeta?.id === t.id ? "3px solid #185fa5" : "3px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: t.activa ? "#1a1a1a" : "#9ca3af" }}>{t.banco}</div>
                  <div style={{ fontSize: "11px", color: "#6b7280" }}>•••• {t.numero_ultimos4}</div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>{t.titular}</div>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: "2px" }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditCard(t)} style={{ ...iconBtn, width: "24px", height: "24px" }}><Edit2 size={11} /></button>
                    <button onClick={() => handleDeleteCard(t.id)} style={{ ...iconBtn, width: "24px", height: "24px", color: "#993C1D" }}><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
              {t.limite > 0 && <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>Límite: {formatCurrency(t.limite)}</div>}
            </div>
          ))}
        </div>

        {/* Panel derecho - gastos */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "320px" }}>
              <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input placeholder="Buscar por comercio, categoría..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px" }} />
            </div>
            <div style={{ background: "white", borderRadius: "8px", padding: "8px 16px", border: "0.5px solid rgba(0,0,0,0.10)", fontSize: "13px", fontWeight: "600" }}>
              Total: {formatCurrency(totalGastos)}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
            <table className="data-table">
              <thead><tr><th>Tarjeta</th><th>Fecha</th><th>Comercio</th><th>Categoría</th><th style={{ textAlign: "right" }}>Importe</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {gastos.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#9ca3af" }}>Sin gastos registrados</td></tr>
                ) : gastos.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontSize: "12px" }}>{g.tarjeta_banco} •••• {g.tarjeta_numero}</td>
                    <td style={{ fontSize: "12px" }}>{formatDate(g.fecha)}</td>
                    <td style={{ fontWeight: "500" }}>{g.comercio}</td>
                    <td>{g.categoria ? <span className="badge badge-blue">{g.categoria}</span> : <span style={{ color: "#9ca3af" }}>—</span>}</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{g.moneda !== "ARS" ? `${g.moneda} ` : ""}{formatCurrency(g.importe)}</td>
                    {isAdmin && <td>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button onClick={() => openEditGasto(g)} style={iconBtn}><Edit2 size={13} /></button>
                        <button onClick={() => handleDeleteGasto(g.id)} style={{ ...iconBtn, color: "#993C1D" }}><Trash2 size={13} /></button>
                      </div>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal tarjeta */}
      {showCardForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowCardForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editCardId ? "Editar tarjeta" : "Nueva tarjeta"}</div>
              <button onClick={() => setShowCardForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div><label style={lbl}>Banco *</label><input value={cardForm.banco} onChange={e => setCardForm(f => ({ ...f, banco: e.target.value }))} placeholder="Ej: Santander" /></div>
              <div><label style={lbl}>Últimos 4 dígitos *</label><input value={cardForm.numero_ultimos4} onChange={e => setCardForm(f => ({ ...f, numero_ultimos4: e.target.value }))} placeholder="1234" maxLength={4} /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Titular *</label><input value={cardForm.titular} onChange={e => setCardForm(f => ({ ...f, titular: e.target.value }))} placeholder="Nombre del titular" /></div>
              <div><label style={lbl}>Límite</label><input type="number" value={cardForm.limite} onChange={e => setCardForm(f => ({ ...f, limite: e.target.value }))} placeholder="0.00" /></div>
              <div><label style={lbl}>Moneda</label>
                <select value={cardForm.moneda} onChange={e => setCardForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
              <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" id="activa" checked={cardForm.activa} onChange={e => setCardForm(f => ({ ...f, activa: e.target.checked }))} />
                <label htmlFor="activa" style={{ fontSize: "13px", fontWeight: "500" }}>Tarjeta activa</label>
              </div>
            </div>
            {error && <div style={{ color: "#993C1D", fontSize: "13px", marginTop: "12px", background: "#f9ece7", padding: "10px", borderRadius: "8px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCardForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveCard} disabled={saving} style={primaryBtn}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gasto */}
      {showGastoForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowGastoForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "12px", padding: "28px", width: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: "700" }}>{editGastoId ? "Editar gasto" : "Nuevo gasto"}</div>
              <button onClick={() => setShowGastoForm(false)} style={iconBtn}><X size={18} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Tarjeta *</label>
                <select value={gastoForm.tarjeta_id} onChange={e => setGastoForm(f => ({ ...f, tarjeta_id: e.target.value }))}>
                  <option value="">— seleccionar —</option>
                  {tarjetas.map(t => <option key={t.id} value={t.id}>{t.banco} •••• {t.numero_ultimos4} ({t.titular})</option>)}
                </select>
              </div>
              <div><label style={lbl}>Fecha *</label><input type="date" value={gastoForm.fecha} onChange={e => setGastoForm(f => ({ ...f, fecha: e.target.value }))} /></div>
              <div><label style={lbl}>Importe *</label><input type="number" value={gastoForm.importe} onChange={e => setGastoForm(f => ({ ...f, importe: e.target.value }))} placeholder="0.00" step="0.01" /></div>
              <div style={{ gridColumn: "span 2" }}><label style={lbl}>Comercio *</label><input value={gastoForm.comercio} onChange={e => setGastoForm(f => ({ ...f, comercio: e.target.value }))} placeholder="Nombre del comercio" /></div>
              <div><label style={lbl}>Categoría</label><input value={gastoForm.categoria} onChange={e => setGastoForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ej: Viáticos, Material" /></div>
              <div><label style={lbl}>Moneda</label>
                <select value={gastoForm.moneda} onChange={e => setGastoForm(f => ({ ...f, moneda: e.target.value }))}>
                  <option value="ARS">ARS</option><option value="USD">USD</option>
                </select>
              </div>
            </div>
            {error && <div style={{ color: "#993C1D", fontSize: "13px", marginTop: "12px", background: "#f9ece7", padding: "10px", borderRadius: "8px" }}>{error}</div>}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowGastoForm(false)} style={cancelBtn}>Cancelar</button>
              <button onClick={handleSaveGasto} disabled={saving} style={primaryBtn}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtn: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.10)", borderRadius: "7px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtn: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
