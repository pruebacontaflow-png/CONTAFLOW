"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function LibroIvaPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const hoy = new Date();
  const [anio, setAnio]   = useState(String(hoy.getFullYear()));
  const [mes,  setMes]    = useState(String(hoy.getMonth() + 1).padStart(2, "0"));
  const [tipo, setTipo]   = useState<"compras"|"ventas">("compras");
  const [data, setData]   = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role === "proveedor") router.push("/portal-proveedor");
  }, [status, role, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/libro-iva?tipo=${tipo}&anio=${anio}&mes=${mes}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [tipo, anio, mes]);

  useEffect(() => { if (status === "authenticated") fetchData(); }, [status, fetchData]);

  const exportar = () => {
    if (!data) return;
    const titulo = tipo === "compras" ? "Libro IVA Compras" : "Libro IVA Ventas";
    const filas = data.facturas.map((f: any) => ({
      "Fecha":            f.fecha,
      "Tipo":             f.tipo_comprobante,
      "Pto Venta":        f.punto_venta,
      "Número":           f.numero,
      "CUIT":             f.cuit,
      "Razón Social":     f.razon_social,
      "Neto Gravado":     f.neto_gravado,
      "No Gravado":       f.neto_no_gravado,
      "Exento":           f.exento,
      "IVA 21%":          f.iva21,
      "IVA 10.5%":        f.iva105,
      "IVA 2.5%":         f.iva25,
      "IVA otro":         f.iva_otro,
      "Perc. IVA":        f.percepcion_iva,
      "Perc. IIBB":       f.percepcion_iibb,
      "Perc. otras":      f.percepcion_otras,
      "Total":            f.total,
    }));
    // Fila de totales
    const t = data.totales;
    filas.push({
      "Fecha": "TOTALES", "Tipo": "", "Pto Venta": "", "Número": "", "CUIT": "", "Razón Social": "",
      "Neto Gravado": t.neto_gravado, "No Gravado": t.neto_no_gravado, "Exento": t.exento,
      "IVA 21%": t.iva21, "IVA 10.5%": t.iva105, "IVA 2.5%": t.iva25, "IVA otro": t.iva_otro,
      "Perc. IVA": t.percepcion_iva, "Perc. IIBB": t.percepcion_iibb, "Perc. otras": t.percepcion_otras,
      "Total": t.total,
    });
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, titulo);
    XLSX.writeFile(wb, `${titulo.replace(/ /g,"_")}_${anio}_${mes}.xlsx`);
  };

  const f = data?.facturas ?? [];
  const t = data?.totales;

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Libro IVA</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Formato AFIP con desglose por alícuota</p>
        </div>
        <button onClick={exportar} disabled={!data || f.length === 0} style={{ display: "flex", alignItems: "center", gap: "7px", background: "#0F6E56", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
          <Download size={15} /> Exportar Excel
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", background: "white", borderRadius: "8px", border: "0.5px solid rgba(0,0,0,0.12)", overflow: "hidden" }}>
          {(["compras","ventas"] as const).map(t => (
            <button key={t} onClick={() => setTipo(t)} style={{
              padding: "8px 18px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: tipo === t ? "700" : "400",
              background: tipo === t ? "#185fa5" : "white", color: tipo === t ? "white" : "#374151",
            }}>
              IVA {t === "compras" ? "Compras" : "Ventas"}
            </button>
          ))}
        </div>
        <select value={anio} onChange={e => setAnio(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "0.5px solid rgba(0,0,0,0.15)", fontFamily: "inherit", fontSize: "13px" }}>
          {[hoy.getFullYear()-1, hoy.getFullYear(), hoy.getFullYear()+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={mes} onChange={e => setMes(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "0.5px solid rgba(0,0,0,0.15)", fontFamily: "inherit", fontSize: "13px" }}>
          {MESES.map((m, i) => <option key={i+1} value={String(i+1).padStart(2,"0")}>{m}</option>)}
        </select>
        <button onClick={fetchData} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#e8f0fa", color: "#185fa5", border: "none", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" }}>
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : f.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
            Sin comprobantes para {MESES[parseInt(mes)-1]} {anio}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ fontSize: "11px" }}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>PV</th>
                  <th>Número</th>
                  <th>CUIT</th>
                  <th>Razón social</th>
                  <th style={{ textAlign: "right", background: "#f0f6ff" }}>Neto grav.</th>
                  <th style={{ textAlign: "right", background: "#f0f6ff" }}>No grav.</th>
                  <th style={{ textAlign: "right", background: "#f0f6ff" }}>Exento</th>
                  <th style={{ textAlign: "right", background: "#e6f4f0" }}>IVA 21%</th>
                  <th style={{ textAlign: "right", background: "#e6f4f0" }}>IVA 10.5%</th>
                  <th style={{ textAlign: "right", background: "#e6f4f0" }}>IVA 2.5%</th>
                  <th style={{ textAlign: "right", background: "#fef3e2" }}>P.IVA</th>
                  <th style={{ textAlign: "right", background: "#fef3e2" }}>P.IIBB</th>
                  <th style={{ textAlign: "right", fontWeight: "700" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {f.map((row: any) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.fecha)}</td>
                    <td style={{ fontFamily: "monospace" }}>{row.tipo_comprobante}</td>
                    <td style={{ fontFamily: "monospace" }}>{row.punto_venta || "—"}</td>
                    <td style={{ fontFamily: "monospace" }}>{row.numero}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "10px" }}>{row.cuit || "—"}</td>
                    <td style={{ maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.razon_social}</td>
                    <td style={{ textAlign: "right", background: "#f8fbff" }}>{row.neto_gravado > 0 ? formatCurrency(row.neto_gravado) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#f8fbff" }}>{row.neto_no_gravado > 0 ? formatCurrency(row.neto_no_gravado) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#f8fbff" }}>{row.exento > 0 ? formatCurrency(row.exento) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#f8fff8" }}>{row.iva21 > 0 ? formatCurrency(row.iva21) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#f8fff8" }}>{row.iva105 > 0 ? formatCurrency(row.iva105) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#f8fff8" }}>{row.iva25 > 0 ? formatCurrency(row.iva25) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#fffdf5" }}>{row.percepcion_iva > 0 ? formatCurrency(row.percepcion_iva) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#fffdf5" }}>{row.percepcion_iibb > 0 ? formatCurrency(row.percepcion_iibb) : "—"}</td>
                    <td style={{ textAlign: "right", fontWeight: "700" }}>{formatCurrency(row.total)}</td>
                  </tr>
                ))}
              </tbody>
              {t && (
                <tfoot>
                  <tr style={{ background: "#f7f8fa", fontWeight: "700" }}>
                    <td colSpan={6} style={{ textAlign: "right", paddingRight: "16px", fontSize: "12px" }}>TOTALES ({f.length} comprobantes)</td>
                    <td style={{ textAlign: "right", background: "#e8f0fa" }}>{formatCurrency(t.neto_gravado)}</td>
                    <td style={{ textAlign: "right", background: "#e8f0fa" }}>{t.neto_no_gravado > 0 ? formatCurrency(t.neto_no_gravado) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#e8f0fa" }}>{t.exento > 0 ? formatCurrency(t.exento) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#d4edda" }}>{t.iva21 > 0 ? formatCurrency(t.iva21) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#d4edda" }}>{t.iva105 > 0 ? formatCurrency(t.iva105) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#d4edda" }}>{t.iva25 > 0 ? formatCurrency(t.iva25) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#fef3e2" }}>{t.percepcion_iva > 0 ? formatCurrency(t.percepcion_iva) : "—"}</td>
                    <td style={{ textAlign: "right", background: "#fef3e2" }}>{t.percepcion_iibb > 0 ? formatCurrency(t.percepcion_iibb) : "—"}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(t.total)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
