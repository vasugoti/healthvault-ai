"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { assistantApi } from "@/lib/api";
import Link from "next/link";
import {
  MessageSquare, Send, Plus, Trash2, Sparkles, FileText,
  Activity, AlertCircle, ShieldCheck
} from "lucide-react";
import { format } from "date-fns";

interface Message {
  id: string; role: "user" | "assistant"; content: string;
  citations: Array<{ type: string; id: string; label: string }>;
  chart: Record<string, unknown> | null; created_at: string;
}
interface Conversation { id: string; title: string; updated_at: string; }

export default function AssistantPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace("/auth/login");
  }, [user, isLoading, router]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await assistantApi.listConversations();
      setConversations(res.data.items || []);
      setSuggestedQuestions(res.data.suggested_questions || []);
    } catch { /* handled */ }
  }, []);

  useEffect(() => { if (user) loadConversations(); }, [user, loadConversations]);

  const selectConversation = async (convId: string) => {
    setActiveConvId(convId);
    setLoadingMessages(true);
    try {
      const res = await assistantApi.getMessages(convId);
      setMessages(res.data.messages || []);
    } catch { setMessages([]); }
    setLoadingMessages(false);
  };

  const newConversation = () => {
    setActiveConvId(null);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    const userMsg = input.trim();
    setInput("");
    setSending(true);

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, {
      id: tempId, role: "user", content: userMsg,
      citations: [], chart: null, created_at: new Date().toISOString(),
    }]);

    // Add typing indicator
    setMessages((prev) => [...prev, {
      id: "typing", role: "assistant", content: "...",
      citations: [], chart: null, created_at: new Date().toISOString(),
    }]);

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await assistantApi.chat(userMsg, activeConvId || undefined);
      const response = res.data;

      if (!activeConvId) {
        setActiveConvId(response.conversation_id);
        loadConversations();
      }

      // Replace typing indicator with real response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "typing"),
        {
          id: response.message_id,
          role: "assistant",
          content: response.text,
          citations: response.citations || [],
          chart: response.chart,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== "typing"),
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "I'm temporarily unavailable. Please try again in a moment.",
          citations: [], chart: null, created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const deleteConversation = async (convId: string) => {
    try {
      await assistantApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) newConversation();
    } catch { /* handled */ }
  };

  if (isLoading || !user) return null;

  return (
    <AppLayout>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        {/* Conversation sidebar */}
        <div style={{
          width: "280px", flexShrink: 0, borderRight: "1px solid var(--border-color)",
          display: "flex", flexDirection: "column", background: "var(--color-neutral-50)",
        }}>
          <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid var(--border-color)" }}>
            <button className="btn btn-primary" onClick={newConversation} style={{ width: "100%" }}>
              <Plus size={15} /> New conversation
            </button>
          </div>

          <div style={{ flex: 1, overflow: "auto", padding: "0.5rem" }}>
            {conversations.length === 0 ? (
              <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                No conversations yet
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  style={{
                    padding: "0.625rem 0.75rem", borderRadius: "8px", cursor: "pointer",
                    background: activeConvId === conv.id ? "var(--color-brand-50)" : "transparent",
                    border: `1px solid ${activeConvId === conv.id ? "var(--color-brand-200)" : "transparent"}`,
                    display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem",
                    transition: "all 0.1s",
                  }}
                  onClick={() => selectConversation(conv.id)}
                >
                  <MessageSquare size={13} color={activeConvId === conv.id ? "var(--color-brand-600)" : "var(--text-muted)"} />
                  <span style={{
                    flex: 1, fontSize: "0.8rem", color: activeConvId === conv.id ? "var(--color-brand-700)" : "var(--text-primary)",
                    fontWeight: activeConvId === conv.id ? 600 : 400,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {conv.title}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{
            padding: "1rem 1.5rem", borderBottom: "1px solid var(--border-color)",
            display: "flex", alignItems: "center", gap: "0.625rem",
            background: "var(--surface-card)",
          }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={15} color="white" />
            </div>
            <div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>HealthVault AI Assistant</div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                Answers grounded in your own health records · No diagnoses
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
            {!activeConvId && messages.length === 0 && (
              <div style={{ maxWidth: "560px", margin: "2rem auto" }}>
                <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                  <div style={{
                    width: "56px", height: "56px", borderRadius: "16px",
                    background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
                    display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem",
                  }}>
                    <Sparkles size={24} color="white" />
                  </div>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Ask about your health data</h2>
                  <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    I can only answer based on your uploaded reports and confirmed metrics. I&apos;ll cite every claim I make.
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div className="text-label" style={{ marginBottom: "0.25rem" }}>Suggested questions</div>
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q} className="btn btn-secondary"
                      onClick={() => { setInput(q); }}
                      style={{ textAlign: "left", justifyContent: "flex-start", fontWeight: 400 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <div style={{
                  marginTop: "1.5rem", padding: "0.875rem 1rem",
                  background: "var(--color-unverified-bg)", border: "1px solid var(--color-unverified-border)",
                  borderRadius: "10px", fontSize: "0.8rem", color: "var(--color-unverified-text)",
                  display: "flex", gap: "0.5rem", alignItems: "flex-start",
                }}>
                  <ShieldCheck size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span>
                    This assistant describes what your data shows — it never diagnoses, recommends medications, or speculates beyond your records.
                  </span>
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`} style={{ marginBottom: "0.25rem" }}>
                {msg.role === "assistant" && (
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "8px",
                    background: "linear-gradient(135deg, #1d74e8, #5aaeff)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <Sparkles size={13} color="white" />
                  </div>
                )}
                <div>
                  <div className={`chat-bubble ${msg.role}`}>
                    {msg.content === "..." ? (
                      <div style={{ display: "flex", gap: "4px", padding: "2px 0" }}>
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{
                            width: "6px", height: "6px", borderRadius: "50%",
                            background: "#94a3b8", animation: `pulse-ring 1.2s ease-in-out infinite`,
                            animationDelay: `${i * 0.2}s`,
                          }} />
                        ))}
                      </div>
                    ) : msg.content}
                  </div>

                  {/* Citations */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginTop: "0.5rem" }}>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Sources:</span>
                      {msg.citations.map((c, i) => (
                        <Link
                          key={i}
                          href={c.type === "metric" ? `/metrics/${c.id}` : `/records/${c.id}`}
                          className="citation-chip"
                        >
                          {c.type === "metric" ? <Activity size={10} /> : <FileText size={10} />}
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: "1rem 1.5rem", borderTop: "1px solid var(--border-color)",
            background: "var(--surface-card)",
          }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end" }}>
              <textarea
                className="input"
                placeholder="Ask about your health data..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                rows={1}
                style={{ flex: 1, resize: "none", minHeight: "44px", maxHeight: "120px" }}
              />
              <button
                id="assistant-send"
                className="btn btn-primary"
                onClick={sendMessage}
                disabled={sending || !input.trim()}
                style={{ flexShrink: 0 }}
              >
                <Send size={15} />
              </button>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>
              Press Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
