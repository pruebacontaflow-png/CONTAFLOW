"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Zap, CheckCircle2, XCircle, RefreshCw, Loader2, Tag, Link2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

const TIPO_REF_LABEL: Record<string, string> = {
  orden_pago: "Orden de pago",
  factura_emitida: "Factura emitida",
  manual: "Manual",
};

export default function ExtractoDetallePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const role = (session?.user as any)?.role;

  const [extracto, setExtracto]   = useState<any | null>(null);
  const [cuentas, setCuentas]     = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [filtro, setFiltro]       = useState<"todos"|"pendiente"|"conciliado">("todos");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editCategoria, setEditCategoria]   = useState("");
  const [editCuentaId, setEditCuentaId]     = useState("");
  const [editObservaciones, setEditObs]     = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [e, c] = await Promise.all([
      fetch(`/api/extractos/${id}`).then(r => r.ok ? r.json() : null),
      fetch("/api/plan-cuentas").then(r => r.ok ? r.json() : []),
    ]);
    setExtracto(e);
    setCuentas(c.filter((c: any) => c.imputable && c.activo));
    setLoading(false);
  }, [id]);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status, fetchData]);

  const handleAutoConcilar = async () => {
    setProcesando(true);
    const res = await fetch(`/api/extractos/${id}/autoconcilar`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      alert(`Auto-conciliadas: ${d.conciliadas} de ${d.total} líneas`);
      fetchData();
    }
    setProcesando(false);
  };

  const handleAplicarReglas = async () => {
    setProcesando(true);
    const res = await fetch(`/api/extractos/${id}/aplicar-reglas`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      alert(`Reglas aplicadas a ${d.aplicadas} de ${d.total} líneas`);
      fetchData();
    }
    setProcesando(false);
  };

  const handleConciliarManual = async (lineaId: number, conciliado: boolean) => {
    await fetch(`/api/extractos/${id}/lineas/${lineaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conciliado }),
    });
    fetchData();
  };

  const handleSaveEdit = async (lineaId: number) => {
    await fetch(`/api/extractos/${id}/lineas/${lineaId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: editCategoria,
        cuenta_contable_id: editCuentaId ? Number(editCuentaId) : null,
        observaciones: editObservaciones,
      }),
    });
    setEditingId(null);
    fetchData();
  };

  if (loading) return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>;
  if (!extracto) return <div style={{ padding: "40px" }}>Extracto no encontrado</div>;

  const lineas = extracto.lineas ?? [];
  const lineasFiltradas = lineas.filter((l: any) => {
    if (filtro === "pendiente")  return !l.conciliado;
    if (filtro === "conciliado") return l.conciliado;
    return true;
  });
  const totalConciliado = lineas.filter((l: any) => l.conciliado).length;
  const pct = lineas.length > 0 ? Math.round((totalConciliado / lineas.length) * 100) : 0;

  return (
    <div style={{ padding: "28px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "16px", marginBottom: "24px" }}>
        <Link href="/extractos" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#6b7280", fontSize: "13px", textDecoration: "none", marginTop: "4px" }}>
          <ArrowLeft size={14} /> Extractos
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>{extracto.banco} – {extracto.tipo_cuenta}</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            {formatDate(extracto.fecha_desde)} al {formatDate(extracto.fecha_hasta)} · {extracto.moneda}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "20px" }}>
        {[
          { label: "Saldo inicial",  val: formatCurrency(extracto.saldo_inicial),   color: "#185fa5" },
          { label: "Débitos",        val: formatCurrency(extracto.total_debitos),    color: "#993C1D" },
          { label: "Créditos",       val: formatCurrency(extracto.total_creditos),   color: "#0F6E56" },
          { label: "Saldo final",    val: formatCurrency(extracto.saldo_final),      color: "#185fa5" },
        ].map(s => (
          <div key={s.label} style={{ background: "white", borderRadius: "10px", border: "0.5px solid rgba(0,0,0,0.10)", padding: "16px" }}>
            <div style={{ fontSize: "11px", color: "#9ca3af", fontWeight: "500", marginBottom: "4px" }}>{s.label}</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Barra de progreso conciliación */}
      <div style={{ background: "white", borderRadius: "10px", border: "0.5px solid rgba(0,0,0,0.10)", padding: "14px 18px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: "600" }}>Conciliación: {totalConciliado}/{lineas.length} líneas ({pct}%)</div>
        <div style={{ flex: 1, height: "8px", background: "#f0f2f5", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "#0F6E56" : "#185fa5", borderRadius: "4px", transition: "width 0.3s" }} />
        </div>
        {["admin","contador"].includes(role) && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={handleAplicarReglas} disabled={procesando} style={secBtnSt}>
              <Tag size={13} /> Aplicar reglas
            </button>
            <button onClick={handleAutoConcilar} disabled={procesando} style={secBtnSt}>
              {procesando ? <Loader2 size={13} /> : <Zap size={13} />} Auto-conciliar
            </button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        {(["todos","pendiente","conciliado"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "6px 14px", border: "none", borderRadius: "7px", cursor: "pointer", fontFamily: "inherit", fontSize: "12px", fontWeight: filtro === f ? "700" : "400",
            background: filtro === f ? "#185fa5" : "#f0f2f5", color: filtro === f ? "white" : "#374151",
          }}>
            {f === "todos" ? `Todos (${lineas.length})` : f === "pendiente" ? `Pendientes (${lineas.filter((l:any)=>!l.conciliado).length})` : `Conciliados (${totalConciliado})`}
          </button>
        ))}
      </div>

      {/* Tabla líneas */}
      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        <table className="data-table" style={{ fontSize: "12px" }}>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Referencia</th>
              <th style={{ textAlign: "right" }}>Débito</th>
              <th style={{ textAlign: "right" }}>Crédito</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th>Categoría / Cuenta</th>
              <th style={{ textAlign: "center" }}>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lineasFiltradas.map((l: any) => (
              <tr key={l.id} style={{ background: l.conciliado ? "#f8fff8" : "white" }}>
                <td style={{ fontSize: "11px" }}>{formatDate(l.fecha)}</td>
                <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.descripcion}</td>
                <td style={{ fontSize: "10px", color: "#9ca3af" }}>{l.referencia || "—"}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace", color: "#993C1D" }}>{l.debito > 0 ? formatCurrency(l.debito) : "—"}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace", color: "#0F6E56" }}>{l.credito > 0 ? formatCurrency(l.credito) : "—"}</td>
                <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "11px", color: "#6b7280" }}>{l.saldo > 0 ? formatCurrency(l.saldo) : "—"}</td>
                <td>
                  {editingId === l.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "180px" }}>
                      <input value={editCategoria} onChange={e => setEditCategoria(e.target.value)} placeholder="Categoría" style={{ fontSize: "11px", padding: "3px 6px", borderRadius: "5px", border: "0.5px solid rgba(0,0,0,0.2)" }} />
                      <select value={editCuentaId} onChange={e => setEditCuentaId(e.target.value)} style={{ fontSize: "11px", padding: "3px 6px", borderRadius: "5px", border: "0.5px solid rgba(0,0,0,0.2)" }}>
                        <option value="">— Sin cuenta —</option>
                        {cuentas.map((c: any) => <option key={c.id} value={c.id}>{c.codigo} – {c.nombre}</option>)}
                      </select>
                      <input value={editObservaciones} onChange={e => setEditObs(e.target.value)} placeholder="Observaciones" style={{ fontSize: "11px", padding: "3px 6px", borderRadius: "5px", border: "0.5px solid rgba(0,0,0,0.2)" }} />
                    </div>
                  ) : (
                    <div>
                      {l.categoria && <span style={{ background: "#fef3e2", color: "#854F0B", padding: "1px 7px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>{l.categoria}</span>}
                      {l.cuenta_codigo && <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "2px" }}>{l.cuenta_codigo} – {l.cuenta_nombre}</div>}
                      {l.conciliado && l.referencia_tipo && (
                        <div style={{ fontSize: "10px", color: "#0F6E56", marginTop: "2px", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Link2 size={9} /> {TIPO_REF_LABEL[l.referencia_tipo]} #{l.referencia_id}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td style={{ textAlign: "center" }}>
                  {l.conciliado ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#e6f4f0", color: "#0F6E56", padding: "2px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "600" }}>
                      <CheckCircle2 size={10} /> OK
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f0f2f5", color: "#9ca3af", padding: "2px 8px", borderRadius: "10px", fontSize: "10px" }}>
                      <XCircle size={10} /> Pendiente
                    </span>
                  )}
                </td>
                <td>
                  <div style={{ display: "flex", gap: "4px" }}>
                    {editingId === l.id ? (
                      <>
                        <button onClick={() => handleSaveEdit(l.id)} style={{ background: "#e6f4f0", color: "#0F6E56", border: "none", borderRadius: "5px", padding: "3px 8px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>OK</button>
                        <button onClick={() => setEditingId(null)} style={{ background: "#f0f2f5", color: "#6b7280", border: "none", borderRadius: "5px", padding: "3px 8px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setEditingId(l.id); setEditCategoria(l.categoria||""); setEditCuentaId(l.cuenta_contable_id ? String(l.cuenta_contable_id) : ""); setEditObs(l.observaciones||""); }}
                          style={{ background: "#f0f2f5", border: "none", borderRadius: "5px", padding: "3px 8px", fontSize: "10px", cursor: "pointer", color: "#374151", fontFamily: "inherit" }}>
                          Editar
                        </button>
                        <button onClick={() => handleConciliarManual(l.id, !l.conciliado)} style={{
                          background: l.conciliado ? "#f9ece7" : "#e6f4f0", border: "none", borderRadius: "5px", padding: "3px 8px",
                          fontSize: "10px", cursor: "pointer", color: l.conciliado ? "#993C1D" : "#0F6E56", fontFamily: "inherit",
                        }}>
                          {l.conciliado ? "Desconciliar" : "Conciliar"}
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lineasFiltradas.length === 0 && (
          <div style={{ padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>
            Sin líneas {filtro === "pendiente" ? "pendientes" : filtro === "conciliado" ? "conciliadas" : ""}
          </div>
        )}
      </div>
    </div>
  );
}

const secBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "6px", background: "#f0f2f5", color: "#374151", border: "none", borderRadius: "7px", padding: "7px 13px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
