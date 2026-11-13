"use client";

import { useState, useEffect } from "react";
import {
  KeyRound, UserX, UserCheck, Plus, X, Eye, EyeOff, ShieldCheck, ShieldOff,
} from "lucide-react";

interface Usuario {
  id: number;
  username: string;
  activo: number;
  created_at: string;
}

interface Props {
  proveedorId: number;
  proveedorNombre: string;
}

export function AccesoSistema({ proveedorId, proveedorNombre }: Props) {
  const [usuario, setUsuario] = useState<Usuario | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showCrear, setShowCrear] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [nuevoUsername, setNuevoUsername] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchUsuario = async () => {
    setLoading(true);
    const res = await fetch(`/api/usuarios/proveedor?proveedor_id=${proveedorId}`);
    const data = await res.json();
    setUsuario(data);
    setLoading(false);
  };

  useEffect(() => { fetchUsuario(); }, [proveedorId]);

  const handleCrear = async () => {
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nuevoUsername, password: nuevaPassword, proveedor_id: proveedorId }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Error"); }
    else {
      setShowCrear(false);
      setNuevoUsername(""); setNuevaPassword("");
      setSuccess("Usuario creado correctamente");
      fetchUsuario();
    }
    setSaving(false);
  };

  const handleToggle = async () => {
    if (!usuario) return;
    const label = usuario.activo ? "¿Desactivar el acceso de este proveedor?" : "¿Reactivar el acceso?";
    if (!confirm(label)) return;
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch(`/api/usuarios/${usuario.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_activo", activo: !usuario.activo }),
    });
    if (res.ok) { setSuccess(usuario.activo ? "Acceso desactivado" : "Acceso reactivado"); fetchUsuario(); }
    else setError("Error al actualizar");
    setSaving(false);
  };

  const handleReset = async () => {
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch(`/api/usuarios/${usuario!.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", nueva_password: resetPassword }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Error"); }
    else { setShowReset(false); setResetPassword(""); setSuccess("Contraseña actualizada"); }
    setSaving(false);
  };

  if (loading) {
    return <div style={{ color: "#9ca3af", fontSize: "12px" }}>Cargando acceso...</div>;
  }

  return (
    <div style={{ marginTop: "20px" }}>
      {/* Título sección */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <ShieldCheck size={15} color="#185fa5" />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>
          Acceso al sistema
        </span>
      </div>

      {/* Mensaje de éxito */}
      {success && (
        <div style={{ background: "#e6f4f0", border: "0.5px solid #0F6E56", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#0F6E56", marginBottom: "10px" }}>
          {success}
        </div>
      )}

      {/* Sin usuario asignado */}
      {usuario === null && !showCrear && (
        <div style={{ background: "#f7f8fa", borderRadius: "10px", padding: "16px", border: "0.5px dashed #d1d5db", textAlign: "center" }}>
          <ShieldOff size={22} color="#d1d5db" style={{ margin: "0 auto 6px" }} />
          <div style={{ fontSize: "12px", color: "#9ca3af", marginBottom: "12px" }}>
            Este proveedor no tiene acceso al portal
          </div>
          <button
            onClick={() => { setShowCrear(true); setNuevoUsername(""); setNuevaPassword(""); setError(""); }}
            style={primaryBtnSm}
          >
            <Plus size={13} /> Crear acceso
          </button>
        </div>
      )}

      {/* Formulario crear */}
      {showCrear && (
        <div style={{ background: "#f0f7ff", borderRadius: "10px", padding: "16px", border: "0.5px solid #c3d9f4" }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#185fa5", marginBottom: "12px" }}>
            Nuevo usuario — {proveedorNombre}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={labelSt}>Nombre de usuario</label>
              <input value={nuevoUsername} onChange={e => setNuevoUsername(e.target.value)}
                placeholder="ej: servicios-ti" style={{ fontSize: "13px" }} />
            </div>
            <div>
              <label style={labelSt}>Contraseña (mínimo 6 caracteres)</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={nuevaPassword}
                  onChange={e => setNuevaPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ fontSize: "13px", paddingRight: "36px" }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>
          {error && <div style={{ fontSize: "12px", color: "#993C1D", marginTop: "8px" }}>{error}</div>}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => setShowCrear(false)} style={cancelBtnSm}>Cancelar</button>
            <button onClick={handleCrear} disabled={saving || !nuevoUsername || !nuevaPassword} style={primaryBtnSm}>
              {saving ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </div>
      )}

      {/* Usuario existente */}
      {usuario && !showCrear && (
        <div style={{
          background: usuario.activo ? "#f7fdf9" : "#f9f9f9",
          borderRadius: "10px",
          padding: "14px 16px",
          border: `0.5px solid ${usuario.activo ? "#c3e6d8" : "#e5e7eb"}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontWeight: "600", fontSize: "14px", fontFamily: "monospace" }}>
                  {String(usuario.username)}
                </span>
                <span style={{
                  padding: "1px 8px", borderRadius: "10px", fontSize: "10px", fontWeight: "700",
                  textTransform: "uppercase",
                  background: usuario.activo ? "#e6f4f0" : "#f0f2f5",
                  color: usuario.activo ? "#0F6E56" : "#6b7280",
                }}>
                  {usuario.activo ? "Activo" : "Inactivo"}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "3px" }}>
                Portal: /portal-proveedor
              </div>
            </div>
          </div>

          {/* Acciones */}
          {!showReset ? (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={() => setShowReset(true)} style={secondaryBtnSm}>
                <KeyRound size={12} /> Resetear contraseña
              </button>
              <button onClick={handleToggle} disabled={saving}
                style={{ ...secondaryBtnSm, color: usuario.activo ? "#993C1D" : "#0F6E56", borderColor: usuario.activo ? "#fca5a5" : "#a7f3d0" }}>
                {usuario.activo ? <><UserX size={12} /> Desactivar acceso</> : <><UserCheck size={12} /> Reactivar acceso</>}
              </button>
            </div>
          ) : (
            <div style={{ marginTop: "8px" }}>
              <label style={labelSt}>Nueva contraseña</label>
              <div style={{ position: "relative", marginBottom: "8px" }}>
                <input
                  type={showPwd ? "text" : "password"}
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ fontSize: "13px", paddingRight: "36px" }}
                  autoFocus
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {error && <div style={{ fontSize: "12px", color: "#993C1D", marginBottom: "6px" }}>{error}</div>}
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => { setShowReset(false); setResetPassword(""); setError(""); }} style={cancelBtnSm}>Cancelar</button>
                <button onClick={handleReset} disabled={saving || resetPassword.length < 6} style={primaryBtnSm}>
                  {saving ? "Guardando..." : "Guardar contraseña"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: "500", color: "#374151", marginBottom: "4px" };
const primaryBtnSm: React.CSSProperties = { display: "flex", alignItems: "center", gap: "5px", background: "#185fa5", color: "white", border: "none", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSm: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
const secondaryBtnSm: React.CSSProperties = { display: "flex", alignItems: "center", gap: "5px", background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "7px", padding: "6px 12px", fontSize: "12px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
