import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings } from "../types";
import { apiContext, apiFetch } from "../types";
import { GlassCard, PrimaryButton } from "./ui/GlassCard";

interface AgentPanelProps {
  settings: AppSettings;
}

interface TreeEntry {
  name: string;
  path: string;
  type: "file" | "dir";
}

interface AgentEvent {
  type: string;
  content?: string;
  name?: string;
  arguments?: string;
  result?: string;
  id?: string;
  iteration?: number;
  max?: number;
  message?: string;
  model?: string;
  temperature?: number;
  summary?: string;
  zero_errors?: boolean;
  path?: string;
}

interface ChatItem {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolArgs?: string;
}

export function AgentPanel({ settings }: AgentPanelProps) {
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState("");
  const [input, setInput] = useState("");
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextFiles, setContextFiles] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [trainingRules, setTrainingRules] = useState(0);
  const [features, setFeatures] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadTree = useCallback(() => {
    apiFetch<{ root: string }>("/api/workspace/root").then((r) => setWorkspaceRoot(r.root));
    apiFetch<{ entries: TreeEntry[] }>("/api/workspace/tree")
      .then((d) => setTree(d.entries))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTree();
    apiFetch<{ tools: string[]; quality_rules_count?: number; recommended_models?: { agent_local?: string[] } }>(
      "/api/agent/config",
    )
      .then((c) => {
        setFeatures(c.tools || []);
        setTrainingRules(c.quality_rules_count || 0);
      })
      .catch(() => {});
  }, [loadTree]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, loading]);

  const toggleContextFile = (path: string) => {
    setContextFiles((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path],
    );
  };

  const openFile = async (path: string) => {
    try {
      const data = await apiFetch<{ content: string; path: string }>(
        `/api/workspace/file?path=${encodeURIComponent(path)}&limit=200`,
      );
      setPreview({ path: data.path, content: data.content });
    } catch {
      /* ignore */
    }
  };

  const runAgent = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setItems((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context_files: contextFiles,
          temperature: settings.temperature,
          ...apiContext(settings),
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let buffer = "";
      let assistantBuffer = "";

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
            const event = JSON.parse(data) as AgentEvent;

            if (event.type === "model" && event.model) {
              setActiveModel(event.model);
            }

            if (event.type === "content" && event.content) {
              assistantBuffer += event.content;
              setItems((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant" && !last.toolName) {
                  last.content = assistantBuffer;
                } else {
                  copy.push({ role: "assistant", content: assistantBuffer });
                }
                return [...copy];
              });
            }

            if (event.type === "tool_call") {
              assistantBuffer = "";
              setItems((prev) => [
                ...prev,
                {
                  role: "tool",
                  content: event.result || "Running…",
                  toolName: event.name,
                  toolArgs: event.arguments,
                },
              ]);
            }

            if (event.type === "tool_result") {
              setItems((prev) => {
                const copy = [...prev];
                for (let i = copy.length - 1; i >= 0; i--) {
                  if (copy[i].role === "tool" && copy[i].toolName === event.name) {
                    copy[i] = {
                      ...copy[i],
                      content: (event.result || "").slice(0, 2000),
                    };
                    break;
                  }
                }
                return copy;
              });
              loadTree();
            }

            if (event.type === "verify" && event.summary) {
              setItems((prev) => [
                ...prev,
                {
                  role: "tool" as const,
                  content: event.summary ?? "",
                  toolName: event.zero_errors ? "verify_code ✓" : "verify_code ✗",
                  toolArgs: event.path ?? "",
                },
              ]);
            }

            if (event.type === "error") {
              setItems((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${event.message}` },
              ]);
            }
          } catch {
            /* skip parse errors */
          }
        }
      }
    } catch (e) {
      setItems((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Failed: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    } finally {
      setLoading(false);
      loadTree();
    }
  };

  return (
    <div className="flex h-[calc(100vh-5.5rem)]">
      {/* File tree */}
      <aside className="glass-panel hidden w-60 shrink-0 overflow-y-auto border-r md:block">
        <div className="border-b border-white/[0.06] p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-glm-accent2">Workspace</p>
          <p className="mt-1 truncate text-[10px] text-glm-muted" title={workspaceRoot}>
            {workspaceRoot}
          </p>
        </div>
        <ul className="space-y-0.5 p-2 text-xs">
          {tree.slice(0, 200).map((entry) => (
            <li key={entry.path}>
              <div className="group flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openFile(entry.path)}
                  className="flex-1 truncate rounded-lg px-2 py-1.5 text-left text-glm-muted transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  {entry.type === "dir" ? "📁" : "📄"} {entry.name}
                </button>
                {entry.type === "file" && (
                  <button
                    type="button"
                    onClick={() => toggleContextFile(entry.path)}
                    className={`rounded-md px-1.5 py-0.5 text-[10px] transition-all ${
                      contextFiles.includes(entry.path)
                        ? "bg-glm-accent text-white shadow-glm-glow"
                        : "border border-glm-border opacity-0 group-hover:opacity-100"
                    }`}
                    title="Attach to context"
                  >
                    @
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </aside>

      {/* Agent chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] bg-glm-card/40 px-4 py-3 backdrop-blur-md">
          <span className="rounded-full bg-glm-accent2/15 px-2.5 py-0.5 text-xs font-semibold text-glm-accent2 ring-1 ring-glm-accent2/30">
            Agent Mode
          </span>
          <span className="text-[10px] text-glm-muted">
            {features.length} tools · {trainingRules} quality rules ·{" "}
            {settings.internetEnabled ? "internet approved" : "local only"}
            {activeModel ? ` · ${activeModel}` : ""}
          </span>
          {contextFiles.map((f) => (
            <span
              key={f}
              className="rounded-full bg-glm-accent/20 px-2 py-0.5 text-[10px] text-glm-accent ring-1 ring-glm-accent/30"
            >
              @{f.split("/").pop()}
              <button type="button" onClick={() => toggleContextFile(f)} className="ml-1">
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {items.length === 0 && (
            <div className="mx-auto max-w-xl py-16 text-center">
              <GlassCard glow className="p-8">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-glm-accent/30 to-glm-accent2/30 text-3xl ring-1 ring-white/10">
                  🤖
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-gradient">Coding Agent</h2>
                <p className="mb-6 text-sm leading-relaxed text-glm-muted">
                  Like Cursor: edit files, run commands, verify code, search the codebase, and use git.
                  {settings.internetEnabled ? " Web tools enabled." : " Fully local — no cloud required."}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    "Run ./start.sh and fix any errors",
                    "Run pytest on the restriction guard tests",
                    "Search the web for FastAPI streaming SSE best practices",
                    "Show git status and summarize recent changes",
                  ].map((s) => (
                    <button key={s} type="button" onClick={() => setInput(s)} className="chip-suggestion">
                      {s}
                    </button>
                  ))}
                </div>
              </GlassCard>
            </div>
          )}

          {items.map((item, i) => (
            <div
              key={i}
              className={`rounded-2xl px-4 py-3 text-sm ${
                item.role === "user"
                  ? "ml-8 border border-glm-accent/30 bg-gradient-to-br from-glm-accent/25 to-sky-500/10 shadow-glm-glow"
                  : item.role === "tool"
                    ? "mr-4 border border-glm-border/80 bg-glm-bg/80 font-mono text-xs backdrop-blur-sm"
                    : "mr-8 border border-white/[0.08] bg-glm-card/70 backdrop-blur-sm"
              }`}
            >
              {item.role === "tool" && (
                <p className="mb-1 font-semibold text-glm-accent2">
                  🔧 {item.toolName}
                  {item.toolArgs && (
                    <span className="ml-2 truncate font-normal text-glm-muted">
                      {item.toolArgs.slice(0, 80)}
                    </span>
                  )}
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans">{item.content}</pre>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 px-4 text-sm text-glm-muted">
              <span className="inline-flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-glm-accent" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-glm-accent [animation-delay:0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-glm-accent [animation-delay:0.3s]" />
              </span>
              Agent working…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/[0.06] bg-glm-surface/80 p-4 backdrop-blur-xl">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  runAgent();
                }
              }}
              placeholder="Ask the agent to code, debug, search the web, run commands…"
              rows={2}
              className="glass-input flex-1 resize-none"
            />
            <PrimaryButton onClick={runAgent} disabled={loading || !input.trim()} className="shrink-0">
              Run
            </PrimaryButton>
          </div>
        </div>
      </div>

      {/* File preview */}
      {preview && (
        <aside className="glass-panel hidden w-80 shrink-0 overflow-y-auto border-l lg:block">
          <div className="flex items-center justify-between border-b border-white/[0.06] p-3">
            <p className="truncate font-mono text-xs">{preview.path}</p>
            <button type="button" onClick={() => setPreview(null)} className="text-xs text-glm-muted hover:text-white">
              ✕
            </button>
          </div>
          <pre className="whitespace-pre-wrap p-3 font-mono text-[10px] text-glm-muted">{preview.content}</pre>
        </aside>
      )}
    </div>
  );
}
