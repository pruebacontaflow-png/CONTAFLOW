"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  HardDrive, RefreshCw, Link2, Link2Off, FolderOpen, CheckCircle,
  AlertCircle, Clock, ChevronRight, ChevronLeft, Loader2
} from "lucide-react";

interface DriveStatus {
  conectado: boolean;
  auth_url: string | null;
  carpeta_id: string | null;
  carpeta_nombre: string | null;
  logs: SyncLog[];
}

interface SyncLog {
  id: number;
  fecha: string;
  carpeta_nombre: string;
  archivos_encontrados: number;
  archivos_procesados: number;
  archivos_duplicados: number;
  archivos_error: number;
  duracion_ms: number;
  estado: "ok" | "parcial" | "error";
  iniciado_por: string;
}

interface Folder {
  id: string;
  name: string;
  modifiedTime?: string;
}

export default function ConfiguracionDrivePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;

  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [error, setError] = useState("");

  // Selector de carpeta
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folderParentStack, setFolderParentStack] = useState<{ id: string; name: string }[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [savingFolder, setSavingFolder] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/drive/status");
      const data = await res.json();
      setDriveStatus(data);
    } catch {
      setError("Error al obtener estado de Drive");
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.push("/login"); return; }
    fetchStatus();

    // Leer params de URL (resultado del OAuth)
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "1") {
      window.history.replaceState({}, "", "/configuracion-drive");
    }
    if (params.get("error")) {
      setError(`Error al conectar: ${params.get("error")}`);
      window.history.replaceState({}, "", "/configuracion-drive");
    }
  }, [status, session, router, fetchStatus]);

  const loadFolders = async (parentId?: string) => {
    setLoadingFolders(true);
    setFolders([]);
    try {
      const url = parentId ? `/api/drive/folders?parent_id=${parentId}` : "/api/drive/folders";
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) setFolders(data);
      else setError(data.error || "Error al cargar carpetas");
    } catch {
      setError("Error al cargar carpetas de Drive");
    } finally {
      setLoadingFolders(false);
    }
  };

  const openFolderPicker = () => {
    setShowFolderPicker(true);
    setFolderParentStack([]);
    loadFolders();
  };

  const enterFolder = (folder: Folder) => {
    setFolderParentStack(prev => [...prev, { id: folder.id, name: folder.name }]);
    loadFolders(folder.id);
  };

  const goBack = () => {
    const newStack = [...folderParentStack];
    newStack.pop();
    setFolderParentStack(newStack);
    const parentId = newStack.length > 0 ? newStack[newStack.length - 1].id : undefined;
    loadFolders(parentId);
  };

  const selectFolder = (folder: Folder) => {
    setSelectedFolder(folder);
  };

  const saveFolder = async () => {
    if (!selectedFolder) return;
    setSavingFolder(true);
    try {
      const res = await fetch("/api/drive/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carpeta_id: selectedFolder.id, carpeta_nombre: selectedFolder.name }),
      });
      const data = await res.json();
      if (data.ok) {
        setShowFolderPicker(false);
        setSelectedFolder(null);
        fetchStatus();
      } else {
        setError(data.error || "Error al guardar carpeta");
      }
    } catch {
      setError("Error al guardar carpeta");
    } finally {
      setSavingFolder(false);
    }
  };

  const syncManual = async () => {
    setSyncing(true);
    setSyncResult(null);
    setError("");
    try {
      const res = await fetch("/api/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solo_nuevos: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(data);
        fetchStatus();
      } else {
        setError(data.error || "Error en la sincronización");
      }
    } catch {
      setError("Error al iniciar sincronización");
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("¿Desconectar la cuenta de Google Drive?")) return;
    try {
      const res = await fetch("/api/drive/disconnect", { method: "DELETE" });
      const data = await res.json();
      if (data.ok) fetchStatus();
      else setError(data.error || "Error al desconectar");
    } catch {
      setError("Error al desconectar");
    }
  };

  if (status === "loading" || loadingStatus) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", gap: "12px", color: "#6b7280" }}>
        <Loader2 size={20} className="animate-spin" /> Cargando...
      </div>
    );
  }

  const isAdmin = role === "admin";

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <HardDrive size={28} color="#185fa5" />
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#111827", margin: 0 }}>
            Google Drive — Importación Automática
          </h1>
          <p style={{ fontSize: "13px", color: "#6b7280", margin: 0 }}>
            Sincroniza PDFs de facturas desde Drive a ContaFlow
          </p>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px", color: "#991b1b", display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
          {error}
          <button onClick={() => setError("")} style={{ marginLeft: "auto", color: "#991b1b", cursor: "pointer", background: "none", border: "none" }}>✕</button>
        </div>
      )}

      {/* Estado de conexión */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {driveStatus?.conectado ? (
              <>
                <CheckCircle size={20} color="#0F6E56" />
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>Conectado a Google Drive</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>info@itclickmedia.com</div>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={20} color="#854F0B" />
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>Sin conexión a Google Drive</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>Conectá para habilitar la importación automática</div>
                </div>
              </>
            )}
          </div>

          {isAdmin && (
            <div style={{ display: "flex", gap: "8px" }}>
              {driveStatus?.conectado ? (
                <button
                  onClick={disconnect}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "13px", color: "#6b7280" }}
                >
                  <Link2Off size={14} /> Desconectar
                </button>
              ) : (
                driveStatus?.auth_url && (
                  <a
                    href={driveStatus.auth_url}
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "#185fa5", color: "#fff", borderRadius: "6px", textDecoration: "none", fontSize: "13px", fontWeight: 500 }}
                  >
                    <Link2 size={14} /> Conectar con Google
                  </a>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {driveStatus?.conectado && (
        <>
          {/* Carpeta configurada */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <FolderOpen size={20} color="#185fa5" />
                <div>
                  <div style={{ fontWeight: 600, color: "#111827" }}>Carpeta de facturas</div>
                  {driveStatus.carpeta_nombre ? (
                    <div style={{ fontSize: "13px", color: "#6b7280" }}>
                      {driveStatus.carpeta_nombre}
                      <span style={{ marginLeft: "8px", fontSize: "11px", background: "#f0fdf4", color: "#0F6E56", padding: "1px 6px", borderRadius: "10px" }}>configurada</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "#854F0B" }}>Sin carpeta seleccionada</div>
                  )}
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={openFolderPicker}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
                >
                  <FolderOpen size={14} /> {driveStatus.carpeta_nombre ? "Cambiar carpeta" : "Elegir carpeta"}
                </button>
              )}
            </div>

            {/* Picker de carpetas */}
            {showFolderPicker && (
              <div style={{ marginTop: "16px", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
                {/* Breadcrumb */}
                <div style={{ background: "#f9fafb", padding: "8px 12px", display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#6b7280", borderBottom: "1px solid #e5e7eb" }}>
                  <button onClick={() => { setFolderParentStack([]); loadFolders(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#185fa5", fontSize: "12px" }}>
                    Mi Drive
                  </button>
                  {folderParentStack.map((f, i) => (
                    <span key={f.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <ChevronRight size={12} />
                      <button
                        onClick={() => {
                          const newStack = folderParentStack.slice(0, i + 1);
                          setFolderParentStack(newStack);
                          loadFolders(f.id);
                        }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: i === folderParentStack.length - 1 ? "#111827" : "#185fa5", fontSize: "12px" }}
                      >
                        {f.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Lista */}
                <div style={{ maxHeight: "220px", overflowY: "auto" }}>
                  {loadingFolders ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                      <Loader2 size={16} className="animate-spin" /> Cargando carpetas...
                    </div>
                  ) : folders.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: "13px" }}>
                      No hay subcarpetas en este nivel
                    </div>
                  ) : (
                    folders.map(folder => (
                      <div
                        key={folder.id}
                        onClick={() => selectFolder(folder)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 14px", cursor: "pointer",
                          background: selectedFolder?.id === folder.id ? "#eff6ff" : "transparent",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                          <FolderOpen size={14} color="#185fa5" />
                          {folder.name}
                          {selectedFolder?.id === folder.id && <CheckCircle size={14} color="#0F6E56" />}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); enterFolder(folder); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex", alignItems: "center", gap: "2px", fontSize: "11px" }}
                        >
                          Ver dentro <ChevronRight size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Botones */}
                <div style={{ padding: "10px 14px", background: "#f9fafb", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {folderParentStack.length > 0 && (
                      <button
                        onClick={goBack}
                        style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                      >
                        <ChevronLeft size={12} /> Atrás
                      </button>
                    )}
                    <button
                      onClick={() => { setShowFolderPicker(false); setSelectedFolder(null); }}
                      style={{ padding: "6px 12px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: "6px", cursor: "pointer", fontSize: "12px", color: "#6b7280" }}
                    >
                      Cancelar
                    </button>
                  </div>
                  <button
                    onClick={saveFolder}
                    disabled={!selectedFolder || savingFolder}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "6px 14px", background: selectedFolder ? "#185fa5" : "#9ca3af",
                      color: "#fff", border: "none", borderRadius: "6px", cursor: selectedFolder ? "pointer" : "not-allowed", fontSize: "12px"
                    }}
                  >
                    {savingFolder ? <Loader2 size={12} className="animate-spin" /> : null}
                    Usar esta carpeta
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sincronización manual */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ fontWeight: 600, color: "#111827", marginBottom: "4px" }}>Sincronización manual</div>
                <div style={{ fontSize: "12px", color: "#6b7280" }}>
                  Importa solo archivos nuevos desde la última sincronización exitosa.
                  La sincronización automática corre cada 10 minutos con el script <code style={{ background: "#f3f4f6", padding: "0 4px", borderRadius: "3px" }}>npm run drive-sync</code>.
                </div>
              </div>
              <button
                onClick={syncManual}
                disabled={syncing || !driveStatus.carpeta_id}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "10px 18px",
                  background: driveStatus.carpeta_id ? "#185fa5" : "#9ca3af",
                  color: "#fff", border: "none", borderRadius: "6px",
                  cursor: driveStatus.carpeta_id ? "pointer" : "not-allowed",
                  fontSize: "14px", fontWeight: 500,
                }}
              >
                {syncing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                {syncing ? "Sincronizando..." : "Sincronizar ahora"}
              </button>
            </div>

            {syncResult && (
              <div style={{ marginTop: "14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "14px" }}>
                <div style={{ fontWeight: 600, color: "#0F6E56", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle size={15} /> Sincronización completada
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", fontSize: "13px" }}>
                  {[
                    { label: "Encontrados", value: syncResult.encontrados, color: "#185fa5" },
                    { label: "Procesados", value: syncResult.procesados, color: "#0F6E56" },
                    { label: "Duplicados", value: syncResult.duplicados, color: "#854F0B" },
                    { label: "Errores", value: syncResult.errores, color: "#993C1D" },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "22px", fontWeight: 700, color: item.color }}>{item.value}</div>
                      <div style={{ color: "#6b7280" }}>{item.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                  Duración: {(syncResult.duracion_ms / 1000).toFixed(1)}s
                </div>
              </div>
            )}
          </div>

          {/* Historial de sincronizaciones */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
              <Clock size={16} color="#185fa5" />
              <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#111827", margin: 0 }}>Historial de sincronizaciones</h2>
            </div>

            {driveStatus.logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px" }}>
                Sin sincronizaciones todavía
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Fecha", "Carpeta", "Encontrados", "Procesados", "Dup.", "Errores", "Tiempo", "Estado", "Por"].map(h => (
                        <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#6b7280", fontWeight: 500, borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {driveStatus.logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "#374151" }}>
                          {new Date(log.fecha).toLocaleString("es-AR")}
                        </td>
                        <td style={{ padding: "8px 10px", color: "#374151", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.carpeta_nombre}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#374151" }}>{log.archivos_encontrados}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#0F6E56", fontWeight: 500 }}>{log.archivos_procesados}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#854F0B" }}>{log.archivos_duplicados}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: log.archivos_error > 0 ? "#993C1D" : "#6b7280" }}>{log.archivos_error}</td>
                        <td style={{ padding: "8px 10px", color: "#6b7280" }}>{(log.duracion_ms / 1000).toFixed(1)}s</td>
                        <td style={{ padding: "8px 10px" }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 500,
                            background: log.estado === "ok" ? "#f0fdf4" : log.estado === "parcial" ? "#fffbeb" : "#fef2f2",
                            color: log.estado === "ok" ? "#0F6E56" : log.estado === "parcial" ? "#854F0B" : "#993C1D",
                          }}>
                            {log.estado}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px", color: "#6b7280" }}>{log.iniciado_por}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
