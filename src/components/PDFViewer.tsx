"use client";

import { X, FileText, Download } from "lucide-react";

interface PDFViewerModalProps {
  filename: string;
  titulo: string;
  onClose: () => void;
}

export function PDFViewerModal({ filename, titulo, onClose }: PDFViewerModalProps) {
  const pdfUrl = `/api/pdf/${filename.replace(/^facturas-pdf\//, "").split("/").map(encodeURIComponent).join("/")}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        background: "rgba(0,0,0,0.65)",
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "900px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "0.5px solid rgba(0,0,0,0.10)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "#e8f0fa",
                borderRadius: "8px",
                width: "34px",
                height: "34px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <FileText size={18} color="#185fa5" />
            </div>
            <div>
              <div style={{ fontWeight: "600", fontSize: "14px", color: "#1a1a2e" }}>
                {titulo}
              </div>
              <div style={{ fontSize: "11px", color: "#9ca3af" }}>{filename}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <a
              href={pdfUrl}
              download={filename}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "#f7f8fa",
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: "7px",
                padding: "6px 12px",
                fontSize: "12px",
                color: "#374151",
                textDecoration: "none",
                fontWeight: "500",
              }}
            >
              <Download size={13} /> Descargar
            </a>
            <button
              onClick={onClose}
              style={{
                background: "#f7f8fa",
                border: "0.5px solid rgba(0,0,0,0.12)",
                borderRadius: "7px",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#6b7280",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PDF embed */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <iframe
            src={pdfUrl}
            style={{
              width: "100%",
              height: "100%",
              minHeight: "520px",
              border: "none",
            }}
            title={titulo}
          />
        </div>
      </div>
    </div>
  );
}
