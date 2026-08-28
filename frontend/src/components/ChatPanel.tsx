import { useRef, useState } from "react";
import type { AppSettings, Message } from "../types";
import { apiFetch } from "../types";

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
            api_key: settings.apiKey || undefined,
            base_url: settings.baseUrl || undefined,
            model: settings.model,
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
            api_key: settings.apiKey || undefined,
            base_url: settings.baseUrl || undefined,
            model: settings.model,
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
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-4xl mx-auto w-full">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-glm-card border border-glm-border flex items-center justify-center text-2xl">
              🤖
            </div>
            <h2 className="text-xl font-semibold mb-2">Local AI — unlimited usage</h2>
            <p className="text-glm-muted text-sm max-w-md mx-auto">
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
                  className="text-xs px-3 py-2 rounded-lg border border-glm-border bg-glm-card text-glm-muted hover:text-white hover:border-glm-accent transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role !== "user" && (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-glm-accent to-glm-accent2 flex items-center justify-center text-xs font-bold shrink-0">
                AI
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-glm-accent text-white rounded-br-md"
                  : "bg-glm-card border border-glm-border text-gray-100 rounded-bl-md"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-lg bg-glm-border flex items-center justify-center text-xs shrink-0">
                You
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-glm-accent to-glm-accent2 flex items-center justify-center text-xs font-bold">
              AI
            </div>
            <div className="bg-glm-card border border-glm-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-glm-accent rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-glm-accent rounded-full animate-bounce [animation-delay:0.15s]" />
                <span className="w-2 h-2 bg-glm-accent rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto max-w-lg p-4 rounded-xl border border-glm-danger/50 bg-glm-danger/10 text-sm text-glm-danger">
            <p className="font-semibold mb-1">Request failed</p>
            <pre className="text-xs whitespace-pre-wrap font-mono opacity-90">{error}</pre>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-glm-border bg-glm-surface/90 backdrop-blur p-4">
        <div className="flex gap-3 items-end">
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
            className="flex-1 resize-none rounded-xl bg-glm-card border border-glm-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50 placeholder:text-glm-muted"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-glm-accent to-glm-accent2 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-glm-accent/25 transition-all shrink-0"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-glm-muted mt-2 text-center">
          Local mode — unlimited messages · No internet required
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
