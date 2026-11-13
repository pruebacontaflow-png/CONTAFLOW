"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, X, Check, KeyRound, UserX, UserCheck, ShieldCheck, Eye, EyeOff, Loader2, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";

const ROL_INFO: Record<string, { label: string; bg: string; color: string }> = {
  admin:    { label: "Admin",    bg: "#fef3e2", color: "#854F0B" },
  contador: { label: "Contador", bg: "#e8f0fa", color: "#185fa5" },
};

export default function UsuariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = (session?.user as any)?.role;
  const myId = (session?.user as any)?.id;

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [nuevoUsername, setNuevoUsername] = useState("");
  const [nuevoPassword, setNuevoPassword] = useState("");
  const [nuevoRol, setNuevoRol] = useState<"admin" | "contador">("contador");
  const [showPwd, setShowPwd] = useState(false);

  // Reset password modal
  const [resetModal, setResetModal] = useState<any>(null);
  const [resetPwd, setResetPwd] = useState("");
  const [showResetPwd, setShowResetPwd] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && role !== "admin") router.push("/dashboard");
  }, [status, role, router]);

  const fetchUsuarios = async () => {
    setLoading(true);
    const res = await fetch("/api/usuarios");
    if (res.ok) setUsuarios(await res.json());
    setLoading(false);
  };

  useEffect(() => { if (status === "authenticated" && role === "admin") fetchUsuarios(); }, [status, role]);

  const handleCrear = async () => {
    if (!nuevoUsername || !nuevoPassword) { setError("Completá usuario y contraseña"); return; }
    setSaving(true); setError(""); setSuccess("");
    const res = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: nuevoUsername, password: nuevoPassword, rol: nuevoRol }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Error"); }
    else {
      setShowForm(false); setNuevoUsername(""); setNuevoPassword("");
      setSuccess(`Usuario "${nuevoUsername}" creado correctamente.`);
      fetchUsuarios();
    }
    setSaving(false);
  };

  const handleToggle = async (u: any) => {
    if (u.id === myId) { setError("No podés desactivar tu propia cuenta"); return; }
    if (!confirm(u.activo ? `¿Desactivar el acceso de ${u.username}?` : `¿Reactivar acceso de ${u.username}?`)) return;
    const res = await fetch(`/api/usuarios/${u.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_activo", activo: !u.activo }),
    });
    if (res.ok) { setSuccess(`Acceso ${u.activo ? "desactivado" : "reactivado"} correctamente.`); fetchUsuarios(); }
    else setError("Error al actualizar");
  };

  const handleReset = async () => {
    if (resetPwd.length < 6) { return; }
    setSaving(true);
    const res = await fetch(`/api/usuarios/${resetModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", nueva_password: resetPwd }),
    });
    if (res.ok) { setSuccess(`Contraseña de "${resetModal.username}" actualizada.`); setResetModal(null); setResetPwd(""); }
    setSaving(false);
  };

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: "700", margin: 0 }}>Usuarios del sistema</h1>
          <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
            Dos roles disponibles: <strong>Admin</strong> (acceso completo) y <strong>Contador</strong> (lectura y operaciones contables).
          </p>
        </div>
        <button onClick={() => { setShowForm(true); setError(""); setNuevoUsername(""); setNuevoPassword(""); setNuevoRol("contador"); }} style={primaryBtnSt}>
          <Plus size={15} /> Nuevo usuario
        </button>
      </div>

      {success && (
        <div style={{ background: "#e6f4f0", border: "0.5px solid #0F6E56", borderRadius: "8px", padding: "10px 16px", fontSize: "13px", color: "#0F6E56", marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
          {success}
          <button onClick={() => setSuccess("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#0F6E56" }}><X size={14} /></button>
        </div>
      )}

      <div style={{ background: "white", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.10)", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Cargando...</div>
        ) : usuarios.length === 0 ? (
          <div style={{ padding: "48px", textAlign: "center" }}>
            <Users size={40} color="#e5e7eb" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontSize: "14px", color: "#9ca3af" }}>No hay usuarios registrados</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u: any) => {
                const ri = ROL_INFO[u.rol] || ROL_INFO.contador;
                const esMiCuenta = u.id === myId;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <ShieldCheck size={15} color={ri.color} />
                        <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "13px" }}>{u.username}</span>
                        {esMiCuenta && <span style={{ fontSize: "10px", color: "#9ca3af" }}>(tu cuenta)</span>}
                      </div>
                    </td>
                    <td>
                      <span style={{ background: ri.bg, color: ri.color, padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "700", textTransform: "uppercase" }}>
                        {ri.label}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        background: u.activo ? "#e6f4f0" : "#f0f2f5",
                        color: u.activo ? "#0F6E56" : "#6b7280",
                        padding: "2px 10px", borderRadius: "10px", fontSize: "11px", fontWeight: "700",
                      }}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td style={{ fontSize: "12px", color: "#6b7280" }}>{formatDate(u.created_at?.split("T")[0] || u.created_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => { setResetModal(u); setResetPwd(""); setShowResetPwd(false); }}
                          style={secBtnSt}
                        >
                          <KeyRound size={12} /> Contraseña
                        </button>
                        {!esMiCuenta && (
                          <button
                            onClick={() => handleToggle(u)}
                            style={{ ...secBtnSt, color: u.activo ? "#993C1D" : "#0F6E56" }}
                          >
                            {u.activo ? <><UserX size={12} /> Desactivar</> : <><UserCheck size={12} /> Activar</>}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo usuario */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "420px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "16px", fontWeight: "700" }}>Nuevo usuario</div>
              <button onClick={() => setShowForm(false)} style={iconBtnSt}><X size={18} /></button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={labelSt}>Nombre de usuario *</label>
                <input value={nuevoUsername} onChange={e => setNuevoUsername(e.target.value)} placeholder="ej: maria.contador" autoFocus />
              </div>
              <div>
                <label style={labelSt}>Rol *</label>
                <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value as any)}>
                  <option value="contador">Contador — Lectura y operaciones contables</option>
                  <option value="admin">Admin — Acceso completo</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Contraseña (mínimo 6 caracteres) *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPwd ? "text" : "password"}
                    value={nuevoPassword}
                    onChange={e => setNuevoPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ paddingRight: "40px" }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ background: "#f9ece7", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#993C1D", marginTop: "12px" }}>{error}</div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setShowForm(false)} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handleCrear} disabled={saving} style={primaryBtnSt}>
                {saving ? <Loader2 size={14} /> : <Check size={14} />} Crear usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal resetear contraseña */}
      {resetModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setResetModal(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }} />
          <div style={{ position: "relative", background: "white", borderRadius: "14px", padding: "28px", width: "380px" }}>
            <div style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Cambiar contraseña</div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
              Usuario: <strong>{resetModal.username}</strong>
            </div>
            <label style={labelSt}>Nueva contraseña *</label>
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <input
                type={showResetPwd ? "text" : "password"}
                value={resetPwd}
                onChange={e => setResetPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                style={{ paddingRight: "40px" }}
                autoFocus
              />
              <button type="button" onClick={() => setShowResetPwd(v => !v)}
                style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                {showResetPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => { setResetModal(null); setResetPwd(""); }} style={cancelBtnSt}>Cancelar</button>
              <button onClick={handleReset} disabled={saving || resetPwd.length < 6} style={primaryBtnSt}>
                {saving ? <Loader2 size={14} /> : <Check size={14} />} Guardar contraseña
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelSt: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: "500", color: "#374151", marginBottom: "5px" };
const iconBtnSt: React.CSSProperties = { background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280" };
const primaryBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "7px", background: "#185fa5", color: "white", border: "none", borderRadius: "8px", padding: "9px 18px", fontSize: "14px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit" };
const cancelBtnSt: React.CSSProperties = { background: "white", color: "#374151", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: "8px", padding: "9px 20px", fontSize: "14px", fontWeight: "500", cursor: "pointer", fontFamily: "inherit" };
const secBtnSt: React.CSSProperties = { display: "flex", alignItems: "center", gap: "5px", background: "#f7f8fa", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: "6px", padding: "5px 10px", fontSize: "11px", fontWeight: "600", cursor: "pointer", fontFamily: "inherit", color: "#374151" };
