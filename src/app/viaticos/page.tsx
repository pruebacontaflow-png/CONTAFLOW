"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronRight, FileText, Search, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Categoría a partir de la descripción ─────────────────────────────────────
function clasificar(desc: string): string {
  const d = (desc || "").toLowerCase();
  if (/almuerzo|comida|merienda|restaurante|desayuno|caf[eé]|lunch|pizza|sushi|cerveza|resto\b|bar\b|empanada|medialunas|tenedor/.test(d))
    return "Viático comida";
  if (/nafta|gasolina|combustible|carga nafta|parking|estacionamiento|garage|didi|taxi|peaje|transporte|uber|cabify|remis|colectivo|subte|tren\b|bus\b/.test(d))
    return "Viático transporte";
  if (/celular|teléfono|telefono|phone/.test(d))
    return "Viático celular";
  return "Otro";
}

function badgeCategoria(cat: string) {
  const map: Record<string, string> = {
    "Viático comida":     "#0F6E56",
    "Viático transporte": "#185fa5",
    "Viático celular":    "#7c3aed",
    "Otro":               "#6b7280",
  };
  return <span style={{ background: map[cat] + "18", color: map[cat], fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "10px", whiteSpace: "nowrap" }}>{cat}</span>;
}

function medioPagoLabel(mp: string) {
  if (mp === "efectivo") return <span style={{ color: "#854F0B", fontWeight: 500 }}>Efectivo</span>;
  if (mp === "transferencia") return <span style={{ color: "#185fa5", fontWeight: 500 }}>Transferencia</span>;
  return <span style={{ color: "#9ca3af" }}>—</span>;
}

export default function RendicionesPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const [grupos, setGrupos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [generando, setGenerando] = useState<string | null>(null);
  const [error, setError] = useState("");

  const cargar = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ search });
    const data = await (await fetch(`/api/rendiciones?${qs}`)).json();
    setGrupos(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [search]);

  const toggleExpand = (clave: string) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave); else next.add(clave);
      return next;
    });
  };

  const generarOp = async (g: any) => {
    if (!confirm(`Generar ${g.medio_pago === "efectivo" ? "OPE (efectivo)" : "OP (transferencia)"} para la rendición de ${g.empleado}?`)) return;
    setGenerando(g.clave); setError("");
    const res = await fetch("/api/rendiciones/generar-op", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: g.clave, medio_pago: g.medio_pago }),
    });
    if (res.ok) {
      const j = await res.json();
      alert(`${j.numero} generada correctamente`);
      cargar();
    } else {
      const j = await res.json();
      setError(j.error || "Error al generar OP");
    }
    setGenerando(null);
  };

  // Totales resumen
  const totalGeneral = grupos.reduce((s, g) => s + (Number(g.total_rendicion) || g.total), 0);
  const sinOp = grupos.filter(g => !g.op_rendicion_id && g.aprobados === g.items.length && g.items.length > 0).length;

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ background: "white", borderBottom: "0.5px solid rgba(0,0,0,0.10)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: "600" }}>Rendiciones</div>
        <div style={{ fontSize: "13px", color: "#6b7280" }}>{grupos.length} rendiciones</div>
      </div>

      <div style={{ padding: "24px 28px", flex: 1, overflowY: "auto" }}>
        {/* Resumen */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "24px" }}>
          <div style={tileStyle}>
            <div style={tileLabel}>Total rendido</div>
            <div style={{ ...tileValue, color: "#111827" }}>{formatCurrency(totalGeneral)}</div>
          </div>
          <div style={tileStyle}>
            <div style={tileLabel}>Rendiciones</div>
            <div style={{ ...tileValue, color: "#185fa5" }}>{grupos.length}</div>
          </div>
          <div style={tileStyle}>
            <div style={tileLabel}>Aprobadas sin OP</div>
            <div style={{ ...tileValue, color: sinOp > 0 ? "#854F0B" : "#0F6E56" }}>{sinOp}</div>
          </div>
        </div>

        {/* Buscador */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
          <div style={{ position: "relative", flex: 1, maxWidth: "380px" }}>
            <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input placeholder="Buscar por empleado, archivo..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: "32px", fontSize: "13px", width: "100%" }} />
          </div>
        </div>

        {error && <div style={{ background: "#f9ece7", color: "#993C1D", padding: "10px 16px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}

        {/* Tabla agrupada */}
        <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
          ) : grupos.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#9ca3af" }}>Sin rendiciones</div>
          ) : (
            <table className="data-table" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "24px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "80px" }} />
                <col />
                <col style={{ width: "110px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "110px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th>Empleado</th>
                  <th>Fecha</th>
                  <th>Archivo</th>
                  <th>Medio de pago</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "center" }}>OP</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(g => {
                  const exp = expandidos.has(g.clave);
                  const todosAprobados = g.items.length > 0 && g.aprobados === g.items.length;
                  const sinOpYAprobado = todosAprobados && !g.op_rendicion_id;
                  const total = Number(g.total_rendicion) || g.total;

                  return [
                    // Fila del grupo
                    <tr
                      key={g.clave}
                      style={{ cursor: "pointer", background: exp ? "#f8f9fb" : undefined }}
                      onDoubleClick={() => toggleExpand(g.clave)}
                      onClick={() => toggleExpand(g.clave)}
                    >
                      <td style={{ padding: "0 6px", width: "28px" }}>
                        {exp
                          ? <ChevronDown size={14} style={{ color: "#6b7280" }} />
                          : <ChevronRight size={14} style={{ color: "#6b7280" }} />
                        }
                      </td>
                      <td style={{ fontWeight: 600 }}>{g.empleado}</td>
                      <td style={{ fontSize: "12px" }}>{g.fecha_rendicion ? formatDate(g.fecha_rendicion) : "—"}</td>
                      <td style={{ fontSize: "12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <FileText size={12} style={{ color: "#9ca3af", flexShrink: 0 }} />
                          {g.archivo_adjunto ? (
                            <a
                              href={`/api/archivo?path=${encodeURIComponent(g.archivo_adjunto)}`}
                              target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{ color: "#185fa5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            >
                              {g.archivo_nombre}
                            </a>
                          ) : <span style={{ color: "#9ca3af" }}>—</span>}
                          <span style={{ color: "#9ca3af", fontSize: "11px", flexShrink: 0 }}>({g.items.length})</span>
                        </div>
                      </td>
                      <td>{medioPagoLabel(g.medio_pago)}</td>
                      <td style={{ textAlign: "center" }}>
                        {todosAprobados
                          ? <span className="badge badge-green">Aprobada</span>
                          : g.aprobados === 0
                          ? <span className="badge badge-yellow">Pendiente</span>
                          : <span className="badge badge-blue">{g.aprobados}/{g.items.length}</span>
                        }
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatCurrency(total)}</td>
                      <td style={{ textAlign: "center" }}>
                        {g.op_rendicion_id ? (
                          <a
                            href={`/ordenes-pago`}
                            onClick={e => e.stopPropagation()}
                            style={{ fontSize: "12px", color: "#185fa5", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}
                          >
                            {g.op_numero} <ExternalLink size={10} />
                          </a>
                        ) : sinOpYAprobado && isAdmin ? (
                          <button
                            onClick={e => { e.stopPropagation(); generarOp(g); }}
                            disabled={generando === g.clave}
                            style={{ fontSize: "11px", background: g.medio_pago === "efectivo" ? "#854F0B" : "#185fa5", color: "white", border: "none", borderRadius: "6px", padding: "4px 8px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                          >
                            {generando === g.clave ? "..." : g.medio_pago === "efectivo" ? "Generar OPE" : "Generar OP"}
                          </button>
                        ) : <span style={{ color: "#9ca3af", fontSize: "12px" }}>—</span>}
                      </td>
                    </tr>,

                    // Detalle expandido
                    exp && (
                      <tr key={`${g.clave}-detail`}>
                        <td colSpan={8} style={{ padding: 0, background: "#f8f9fb", borderBottom: "1.5px solid #e5e7eb" }}>
                          <div style={{ padding: "0 20px 12px 48px" }}>
                            {g.observacion && (
                              <div style={{ fontSize: "12px", color: "#854F0B", padding: "8px 12px", background: "#fef3cd", borderRadius: "6px", marginBottom: "10px", marginTop: "8px" }}>
                                {g.observacion}
                              </div>
                            )}
                            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                              <thead>
                                <tr style={{ background: "#f3f4f6" }}>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>FECHA</th>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>DESCRIPCIÓN</th>
                                  <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>CATEGORÍA</th>
                                  <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>IMPORTE</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map((it: any, idx: number) => {
                                  const cat = clasificar(it.descripcion);
                                  return (
                                    <tr key={it.id} style={{ background: idx % 2 === 1 ? "#f9fafb" : "white", borderTop: "0.5px solid #e5e7eb" }}>
                                      <td style={{ padding: "5px 8px" }}>{it.fecha ? formatDate(it.fecha) : "—"}</td>
                                      <td style={{ padding: "5px 8px", color: "#374151" }}>{it.descripcion || it.tipo || "—"}</td>
                                      <td style={{ padding: "5px 8px" }}>{badgeCategoria(cat)}</td>
                                      <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{formatCurrency(it.importe)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ borderTop: "1.5px solid #d1d5db" }}>
                                  <td colSpan={3} style={{ padding: "6px 8px", fontWeight: 600, color: "#374151", fontSize: "12px" }}>Total rendición</td>
                                  <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#111827" }}>
                                    {formatCurrency(Number(g.total_rendicion) || g.total)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

const tileStyle: React.CSSProperties = {
  background: "white", borderRadius: "12px", padding: "16px 20px",
  border: "0.5px solid rgba(0,0,0,0.10)",
};
const tileLabel: React.CSSProperties = { fontSize: "12px", color: "#6b7280", marginBottom: "6px" };
const tileValue: React.CSSProperties = { fontSize: "22px", fontWeight: 700 };
