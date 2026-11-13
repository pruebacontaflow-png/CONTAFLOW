"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { ChatBot } from "./ChatBot";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f1f3f6',
      }}>
        <div style={{ color: '#6b7280', fontSize: '14px' }}>Cargando...</div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main style={{
        marginLeft: '220px',
        flex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f1f3f6',
        overflow: 'auto',
      }}>
        {children}
      </main>
      <ChatBot />
    </div>
  );
}
