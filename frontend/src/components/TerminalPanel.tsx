import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../types";

interface RunResult {
  type?: string;
  command?: string;
  path?: string;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  timed_out?: boolean;
  error?: string;
}

interface ScriptsConfig {
  enabled: boolean;
  run_terminal: { enabled: boolean; default_timeout_seconds: number };
  run_script: { enabled: boolean; default_timeout_seconds: number };
  allowed_script_extensions: string[];
  examples?: string[];
}

interface HistoryItem {
  kind: "command" | "script";
  label: string;
  result: RunResult;
}

export function TerminalPanel() {
  const [mode, setMode] = useState<"command" | "script">("command");
  const [command, setCommand] = useState("");
  const [scriptPath, setScriptPath] = useState("");
  const [scriptArgs, setScriptArgs] = useState("");
  const [cwd, setCwd] = useState(".");
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<ScriptsConfig | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<ScriptsConfig>("/api/scripts-commands/config").then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const appendResult = useCallback((kind: "command" | "script", label: string, result: RunResult) => {
    setHistory((prev) => [...prev, { kind, label, result }]);
  }, []);

  const runCommand = async () => {
    const cmd = command.trim();
    if (!cmd || loading) return;
    setLoading(true);
    try {
      const result = await apiFetch<RunResult>("/api/terminal/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd, cwd }),
      });
      appendResult("command", cmd, result);
      setCommand("");
    } catch (e) {
      appendResult("command", cmd, { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  const runScript = async () => {
    const path = scriptPath.trim();
    if (!path || loading) return;
    setLoading(true);
    const label = scriptArgs.trim() ? `${path} ${scriptArgs.trim()}` : path;
    try {
      const result = await apiFetch<RunResult>("/api/scripts/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, args: scriptArgs, cwd }),
      });
      appendResult("script", label, result);
    } catch (e) {
      appendResult("script", label, { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col h-[calc(100dvh-3.5rem)] lg:h-[100dvh]">
      <div className="mb-4">
        <h2 className="text-2xl font-semibold">Terminal & Scripts</h2>
        <p className="text-sm text-glm-muted mt-1">
          Run shell commands and script files locally in the workspace — no internet approval needed.
        </p>
        {config && (
          <p className="text-xs text-glm-muted font-mono mt-1">
            Timeouts: commands {config.run_terminal.default_timeout_seconds}s · scripts{" "}
            {config.run_script.default_timeout_seconds}s ·{" "}
            {config.allowed_script_extensions.join(" ")}
          </p>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {(["command", "script"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              mode === m
                ? "bg-glm-accent border-glm-accent text-white"
                : "border-glm-border text-glm-muted"
            }`}
          >
            {m === "command" ? "Shell command" : "Run script file"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-glm-border bg-glm-card p-4 mb-4 space-y-3">
        <div>
          <label className="text-xs text-glm-muted block mb-1">Working directory (relative)</label>
          <input
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            className="w-full rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm font-mono"
          />
        </div>

        {mode === "command" ? (
          <div className="flex gap-2">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runCommand()}
              placeholder="npm test, python3 -m pytest, git status, ./start.sh …"
              className="flex-1 rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              onClick={runCommand}
              disabled={loading || !command.trim()}
              className="px-4 py-2 rounded-lg bg-glm-accent text-white text-sm font-medium disabled:opacity-50"
            >
              Run
            </button>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-glm-muted block mb-1">Script path</label>
              <input
                value={scriptPath}
                onChange={(e) => setScriptPath(e.target.value)}
                placeholder="start.sh, backend/main.py, frontend/package.json scripts via command tab"
                className="w-full rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="flex gap-2">
              <input
                value={scriptArgs}
                onChange={(e) => setScriptArgs(e.target.value)}
                placeholder="Optional args"
                className="flex-1 rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                onClick={runScript}
                disabled={loading || !scriptPath.trim()}
                className="px-4 py-2 rounded-lg bg-glm-accent text-white text-sm font-medium disabled:opacity-50"
              >
                Run script
              </button>
            </div>
          </>
        )}
      </div>

      {config?.examples && (
        <div className="flex flex-wrap gap-2 mb-4">
          {config.examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                if (ex.startsWith("run_script:")) {
                  setMode("script");
                  setScriptPath(ex.replace("run_script:", "").trim());
                } else if (ex.startsWith("run_terminal:")) {
                  setMode("command");
                  setCommand(ex.replace("run_terminal:", "").trim());
                }
              }}
              className="text-xs px-2 py-1 rounded border border-glm-border text-glm-muted hover:text-white"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
        {history.length === 0 && (
          <p className="text-sm text-glm-muted text-center py-8">
            Run a command or script — output appears here with exit code.
          </p>
        )}
        {history.map((item, i) => (
          <div key={i} className="rounded-xl border border-glm-border bg-glm-bg/80 p-4 font-mono text-xs">
            <div className="flex justify-between gap-2 mb-2 text-glm-accent2">
              <span>
                {item.kind === "command" ? "$" : "📜"} {item.label}
              </span>
              {item.result.error ? (
                <span className="text-glm-danger">error</span>
              ) : (
                <span className={item.result.exit_code === 0 ? "text-glm-success" : "text-glm-danger"}>
                  exit {item.result.exit_code}
                  {item.result.timed_out ? " (timeout)" : ""}
                </span>
              )}
            </div>
            {item.result.error && (
              <pre className="text-glm-danger whitespace-pre-wrap">{item.result.error}</pre>
            )}
            {item.result.stdout && (
              <pre className="text-glm-muted whitespace-pre-wrap mb-2">{item.result.stdout}</pre>
            )}
            {item.result.stderr && (
              <pre className="text-amber-400/90 whitespace-pre-wrap">{item.result.stderr}</pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
