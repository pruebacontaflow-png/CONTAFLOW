"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Loader } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hola, soy el asistente contable de ContaFlow. Podés preguntarme cosas como:\n• ¿Cuánto le debemos a [proveedor]?\n• ¿Qué facturas tenemos pendientes de cobro?\n• ¿Cuál es el saldo bancario?\n• ¿Qué vencimientos hay esta semana?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = await res.json();
      setMessages(m => [...m, { role: "assistant", content: data.message || data.error || "Error al procesar la consulta." }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "Error de conexión. Intentá de nuevo." }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 500,
          width: "52px", height: "52px", borderRadius: "50%",
          background: "#185fa5", color: "white", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 4px 16px rgba(24,95,165,0.35)",
          transition: "transform 0.15s",
        }}
        title="Asistente contable"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "84px", right: "24px", zIndex: 499,
          width: "380px", height: "520px",
          background: "white", borderRadius: "16px",
          border: "0.5px solid rgba(0,0,0,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 18px", background: "#185fa5", display: "flex", alignItems: "center", gap: "10px" }}>
            <Bot size={18} color="white" />
            <div>
              <div style={{ fontSize: "14px", fontWeight: "700", color: "white" }}>Asistente ContaFlow</div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)" }}>Consultas sobre datos reales</div>
            </div>
          </div>

          {/* Mensajes */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  flexShrink: 0, width: "28px", height: "28px", borderRadius: "50%",
                  background: m.role === "user" ? "#185fa5" : "#f3f4f6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {m.role === "user" ? <User size={14} color="white" /> : <Bot size={14} color="#6b7280" />}
                </div>
                <div style={{
                  maxWidth: "82%", padding: "10px 12px",
                  background: m.role === "user" ? "#185fa5" : "#f9fafb",
                  color: m.role === "user" ? "white" : "#1f2937",
                  borderRadius: m.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  fontSize: "13px", lineHeight: "1.5", whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Bot size={14} color="#6b7280" />
                </div>
                <div style={{ padding: "10px 12px", background: "#f9fafb", borderRadius: "4px 12px 12px 12px", display: "flex", gap: "4px", alignItems: "center" }}>
                  <Loader size={13} color="#9ca3af" style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: "12px", color: "#9ca3af" }}>Consultando...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "0.5px solid rgba(0,0,0,0.08)", display: "flex", gap: "8px" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Preguntá sobre proveedores, facturas, saldos..."
              disabled={loading}
              style={{ flex: 1, padding: "8px 12px", fontSize: "13px", borderRadius: "8px", border: "0.5px solid #e5e7eb", outline: "none", fontFamily: "inherit" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              style={{
                width: "36px", height: "36px", borderRadius: "8px",
                background: input.trim() && !loading ? "#185fa5" : "#e5e7eb",
                border: "none", cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s",
              }}
            >
              <Send size={15} color={input.trim() && !loading ? "white" : "#9ca3af"} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
