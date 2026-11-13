"use client";

import { useState, useRef } from "react";
import { Upload, Eye, FileText, Paperclip, Loader2, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PDFViewerModal } from "./PDFViewer";
import { useSession } from "next-auth/react";

const ESTADO_LABEL: Record<string, string> = {
  pendiente_pago: "Pendiente",
  pagada: "Pagada",
  observada: "Observada",
  cobro_pendiente: "Pend. cobro",
  cobrada: "Cobrada",
  vencida: "Vencida",
};

interface Factura {
  id: number;
  tipo_comprobante: string;
  numero: string;
  fecha_emision: string;
  importe_total: number;
  estado: string;
  pdf_path?: string;
}

interface Props {
  facturas: Factura[];
  tipo: "recibidas" | "emitidas";
  onFacturaUpdated: (id: number, pdfPath: string) => void;
}

export function DocumentosAdjuntos({ facturas, tipo, onFacturaUpdated }: Props) {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const [pdfViewer, setPdfViewer] = useState<{ filename: string; titulo: string } | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadId, setCurrentUploadId] = useState<number | null>(null);

  if (facturas.length === 0) {
    return (
      <div
        style={{
          background: "#f7f8fa",
          borderRadius: "10px",
          padding: "24px",
          textAlign: "center",
          border: "0.5px dashed #d1d5db",
        }}
      >
        <Paperclip size={24} color="#d1d5db" style={{ margin: "0 auto 8px" }} />
        <div style={{ fontSize: "13px", color: "#9ca3af" }}>Sin documentos adjuntos todavía</div>
      </div>
    );
  }

  const handleUploadClick = (facturaId: number) => {
    setCurrentUploadId(facturaId);
    setUploadError("");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || currentUploadId === null) return;

    if (file.type !== "application/pdf") {
      setUploadError("Solo se permiten archivos PDF");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("El archivo no puede superar 10 MB");
      return;
    }

    setUploading(currentUploadId);
    setUploadError("");

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      const endpoint =
        tipo === "recibidas"
          ? `/api/facturas-recibidas/${currentUploadId}/pdf`
          : `/api/facturas-emitidas/${currentUploadId}/pdf`;

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || "Error al subir el archivo");
      } else {
        onFacturaUpdated(currentUploadId, data.filename);
      }
    } catch {
      setUploadError("Error de conexión al subir el archivo");
    } finally {
      setUploading(null);
      // Limpiar el input para poder volver a subir el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeletePdf = async (facturaId: number) => {
    if (!confirm("¿Eliminar el PDF adjunto de esta factura?")) return;
    const endpoint =
      tipo === "recibidas"
        ? `/api/facturas-recibidas/${facturaId}/pdf`
        : `/api/facturas-emitidas/${facturaId}/pdf`;
    const res = await fetch(endpoint, { method: "DELETE" });
    if (res.ok) onFacturaUpdated(facturaId, "");
  };

  return (
    <>
      {/* File input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {uploadError && (
        <div
          style={{
            background: "#f9ece7",
            border: "0.5px solid #993C1D",
            borderRadius: "8px",
            padding: "8px 14px",
            fontSize: "12px",
            color: "#993C1D",
            marginBottom: "10px",
          }}
        >
          {uploadError}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {facturas.map((f) => {
          const hasPdf = !!f.pdf_path;
          const isLoading = uploading === f.id;
          const estadoColor =
            f.estado === "pagada" || f.estado === "cobrada"
              ? { bg: "#e6f4f0", text: "#0F6E56" }
              : f.estado === "observada" || f.estado === "vencida"
              ? { bg: "#f9ece7", text: "#993C1D" }
              : { bg: "#fef3e2", text: "#854F0B" };

          return (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 14px",
                background: hasPdf ? "#f7fbf9" : "white",
                borderRadius: "8px",
                border: `0.5px solid ${hasPdf ? "#c3e6d8" : "rgba(0,0,0,0.10)"}`,
              }}
            >
              {/* Icono */}
              <div
                style={{
                  background: hasPdf ? "#e6f4f0" : "#f7f8fa",
                  borderRadius: "7px",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText size={16} color={hasPdf ? "#0F6E56" : "#9ca3af"} />
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <span
                    style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: "600", color: "#1a1a2e" }}
                  >
                    {f.tipo_comprobante}-{f.numero}
                  </span>
                  <span
                    style={{
                      background: estadoColor.bg,
                      color: estadoColor.text,
                      padding: "1px 7px",
                      borderRadius: "10px",
                      fontSize: "10px",
                      fontWeight: "600",
                      textTransform: "uppercase",
                    }}
                  >
                    {ESTADO_LABEL[f.estado] || f.estado}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                  {formatDate(f.fecha_emision)} · {formatCurrency(f.importe_total)}
                </div>
              </div>

              {/* Acciones */}
              <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                {hasPdf ? (
                  <>
                    <button
                      onClick={() =>
                        setPdfViewer({
                          filename: f.pdf_path!,
                          titulo: `${f.tipo_comprobante}-${f.numero}`,
                        })
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#185fa5",
                        color: "white",
                        border: "none",
                        borderRadius: "7px",
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <Eye size={13} /> Ver PDF
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePdf(f.id)}
                        style={{
                          background: "#f7f8fa",
                          border: "0.5px solid rgba(0,0,0,0.12)",
                          borderRadius: "7px",
                          width: "28px",
                          height: "28px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#993C1D",
                        }}
                        title="Eliminar PDF"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </>
                ) : isAdmin ? (
                  <button
                    onClick={() => handleUploadClick(f.id)}
                    disabled={isLoading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                      background: "white",
                      color: "#185fa5",
                      border: "0.5px solid #185fa5",
                      borderRadius: "7px",
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: "600",
                      cursor: isLoading ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: isLoading ? 0.7 : 1,
                    }}
                  >
                    {isLoading ? (
                      <><Loader2 size={12} className="spin-anim" /> Subiendo...</>
                    ) : (
                      <><Upload size={12} /> Subir PDF</>
                    )}
                  </button>
                ) : (
                  <span style={{ fontSize: "11px", color: "#d1d5db", fontStyle: "italic" }}>
                    Sin PDF
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal visor PDF */}
      {pdfViewer && (
        <PDFViewerModal
          filename={pdfViewer.filename}
          titulo={pdfViewer.titulo}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </>
  );
}
