"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Lock, User, TrendingUp, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.ok) {
      // Redirigir según el rol — getSession para leer el JWT actualizado
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      const role = (session?.user as any)?.role;
      if (role === "proveedor") {
        router.push("/portal-proveedor");
      } else if (role === "contador") {
        router.push("/reportes");
      } else {
        router.push("/dashboard");
      }
    } else {
      setError("Usuario o contraseña incorrectos");
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f1f3f6',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        border: '0.5px solid rgba(0,0,0,0.10)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px',
          }}>
            <div style={{
              background: '#185fa5',
              borderRadius: '10px',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <TrendingUp size={24} color="white" />
            </div>
            <span style={{ fontSize: '26px', fontWeight: '700', color: '#185fa5', letterSpacing: '-0.5px' }}>
              ContaFlow
            </span>
          </div>
          <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
            Gestión contable para PyMEs argentinas
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Usuario
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresá tu usuario"
                required
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresá tu contraseña"
                required
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#f9ece7',
              border: '0.5px solid #993C1D',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '16px',
              color: '#993C1D',
              fontSize: '13px',
            }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading ? '#6b9fd4' : '#185fa5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '11px',
              fontSize: '15px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div style={{ marginTop: '24px', fontSize: '12px', color: '#9ca3af', textAlign: 'center' }}>
          IT Click Video S.A. · Acceso restringido
        </div>
      </div>
    </div>
  );
}
