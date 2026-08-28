import { useCallback, useEffect, useRef, useState } from "react";
import type { AppSettings } from "../types";
import { apiFetch } from "../types";

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
          api_key: settings.apiKey || "local",
          base_url: settings.baseUrl,
          model: settings.model,
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
    <div className="flex h-[calc(100vh-4.5rem)]">
      {/* File tree */}
      <aside className="w-56 shrink-0 border-r border-glm-border bg-glm-surface overflow-y-auto hidden md:block">
        <div className="p-3 border-b border-glm-border">
          <p className="text-xs font-semibold text-glm-muted uppercase tracking-wide">Workspace</p>
          <p className="text-[10px] text-glm-muted truncate mt-1" title={workspaceRoot}>
            {workspaceRoot}
          </p>
        </div>
        <ul className="p-2 space-y-0.5 text-xs">
          {tree.slice(0, 200).map((entry) => (
            <li key={entry.path}>
              <div className="flex items-center gap-1 group">
                <button
                  type="button"
                  onClick={() => openFile(entry.path)}
                  className="flex-1 text-left px-2 py-1 rounded hover:bg-glm-card truncate text-glm-muted hover:text-white"
                >
                  {entry.type === "dir" ? "📁" : "📄"} {entry.name}
                </button>
                {entry.type === "file" && (
                  <button
                    type="button"
                    onClick={() => toggleContextFile(entry.path)}
                    className={`px-1.5 py-0.5 rounded text-[10px] ${
                      contextFiles.includes(entry.path)
                        ? "bg-glm-accent text-white"
                        : "opacity-0 group-hover:opacity-100 border border-glm-border"
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
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-2 border-b border-glm-border bg-glm-card/50 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-glm-accent2">Agent Mode</span>
          <span className="text-[10px] text-glm-muted">
            {features.length} tools · {trainingRules} quality rules · internet on
            {activeModel ? ` · ${activeModel}` : ""}
          </span>
          {contextFiles.map((f) => (
            <span
              key={f}
              className="text-[10px] px-2 py-0.5 rounded-full bg-glm-accent/20 text-glm-accent"
            >
              @{f.split("/").pop()}
              <button type="button" onClick={() => toggleContextFile(f)} className="ml-1">
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {items.length === 0 && (
            <div className="text-center py-12 max-w-lg mx-auto">
              <h2 className="text-xl font-semibold mb-2">Coding Agent</h2>
              <p className="text-sm text-glm-muted mb-4">
                Like Cursor: edit files, run terminal, search codebase, verify code (Ruff/mypy/ESLint/tsc), browse the web, use git.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Fix all TypeScript errors in this project",
                  "Add tests for the restriction guard",
                  "Search the web for FastAPI streaming SSE best practices",
                  "Show git status and summarize recent changes",
                ].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setInput(s)}
                    className="text-xs px-3 py-2 rounded-lg border border-glm-border hover:border-glm-accent text-glm-muted hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.map((item, i) => (
            <div
              key={i}
              className={`rounded-xl px-4 py-3 text-sm ${
                item.role === "user"
                  ? "bg-glm-accent/20 border border-glm-accent/30 ml-8"
                  : item.role === "tool"
                    ? "bg-glm-bg border border-glm-border font-mono text-xs mr-4"
                    : "bg-glm-card border border-glm-border mr-8"
              }`}
            >
              {item.role === "tool" && (
                <p className="text-glm-accent2 font-semibold mb-1">
                  🔧 {item.toolName}
                  {item.toolArgs && (
                    <span className="text-glm-muted font-normal ml-2 truncate">
                      {item.toolArgs.slice(0, 80)}
                    </span>
                  )}
                </p>
              )}
              <pre className="whitespace-pre-wrap font-sans">{item.content}</pre>
            </div>
          ))}

          {loading && (
            <div className="text-sm text-glm-muted animate-pulse px-4">Agent working…</div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-glm-border p-4 bg-glm-surface/90">
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
              className="flex-1 resize-none rounded-xl bg-glm-card border border-glm-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
            />
            <button
              type="button"
              onClick={runAgent}
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-glm-accent to-glm-accent2 font-semibold text-sm disabled:opacity-40 shrink-0"
            >
              Run
            </button>
          </div>
        </div>
      </div>

      {/* File preview */}
      {preview && (
        <aside className="w-72 shrink-0 border-l border-glm-border bg-glm-surface overflow-y-auto hidden lg:block">
          <div className="p-3 border-b border-glm-border flex justify-between items-center">
            <p className="text-xs font-mono truncate">{preview.path}</p>
            <button type="button" onClick={() => setPreview(null)} className="text-glm-muted text-xs">
              ✕
            </button>
          </div>
          <pre className="p-3 text-[10px] font-mono text-glm-muted whitespace-pre-wrap">
            {preview.content}
          </pre>
        </aside>
      )}
    </div>
  );
}
