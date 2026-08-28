import { useRef, useState } from "react";
import type { AppSettings, Message } from "../types";
import { apiContext, apiFetch } from "../types";
import { GlassCard, PrimaryButton } from "./ui/GlassCard";

interface ChatPanelProps {
  settings: AppSettings;
}

export function ChatPanel({ settings }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const buildPayloadMessages = (userContent: string): Message[] => {
    const base: Message[] = [];
    if (settings.systemPrompt.trim()) {
      base.push({ role: "system", content: settings.systemPrompt.trim() });
    }
    base.push(...messages);
    base.push({ role: "user", content: userContent });
    return base;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    scrollToBottom();

    const payloadMessages = buildPayloadMessages(text);

    try {
      if (settings.stream) {
        const assistantIndex = messages.length + 1;
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: payloadMessages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            stream: true,
            thinking_enabled: settings.thinkingEnabled,
            ...apiContext(settings),
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText);
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No response stream");

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data) as { content?: string; error?: string };
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.content) {
                setMessages((prev) => {
                  const copy = [...prev];
                  const msg = copy[assistantIndex];
                  if (msg) msg.content += parsed.content!;
                  return copy;
                });
                scrollToBottom();
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      } else {
        const data = await apiFetch<{ content: string }>("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: payloadMessages,
            temperature: settings.temperature,
            max_tokens: settings.maxTokens,
            stream: false,
            thinking_enabled: settings.thinkingEnabled,
            ...apiContext(settings),
          }),
        });
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
        scrollToBottom();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(formatError(msg));
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-5.5rem)] w-full max-w-4xl flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="py-16 text-center">
            <GlassCard glow className="mx-auto max-w-lg p-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-glm-accent/30 to-glm-accent2/30 text-3xl ring-1 ring-white/10">
                💬
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-gradient">Local AI — unlimited usage</h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-glm-muted">
                Runs entirely on your PC via Ollama. No API keys, no cloud, no usage caps. Use Chat
                for anything or the PC Builder tab for gaming rig recommendations.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "Best GPU for 1440p 240Hz under $600",
                  "Compare Intel vs AMD for gaming in 2026",
                  "How much RAM for AAA gaming?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="chip-suggestion"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </GlassCard>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role !== "user" && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-glm-accent to-glm-accent2 text-xs font-bold shadow-glm-glow">
                AI
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "rounded-br-md bg-gradient-to-br from-glm-accent to-sky-500 text-white shadow-glm-glow"
                  : "rounded-bl-md border border-white/[0.08] bg-glm-card/70 text-gray-100 backdrop-blur-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.08] text-xs ring-1 ring-white/10">
                You
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-glm-accent to-glm-accent2 text-xs font-bold shadow-glm-glow">
              AI
            </div>
            <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-glm-card/70 px-4 py-3 backdrop-blur-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-glm-accent" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-glm-accent [animation-delay:0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-glm-accent [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-lg rounded-xl border border-glm-danger/50 bg-glm-danger/10 p-4 text-sm text-glm-danger">
            <p className="mb-1 font-semibold">Request failed</p>
            <pre className="whitespace-pre-wrap font-mono text-xs opacity-90">{error}</pre>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] bg-glm-surface/80 p-4 backdrop-blur-xl">
        <div className="flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Message GLM-5.1…"
            rows={2}
            className="glass-input flex-1 resize-none"
          />
          <PrimaryButton onClick={handleSend} disabled={loading || !input.trim()} className="shrink-0">
            Send
          </PrimaryButton>
        </div>
        <p className="mt-2 text-center text-xs text-glm-muted">
          Local mode — unlimited messages · External connections off until approved in Settings
        </p>
      </div>
    </div>
  );
}

function formatError(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed.detail) {
      return JSON.stringify(parsed.detail, null, 2);
    }
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}
