import { useEffect, useState, type ReactNode } from "react";
import type { AppSettings, LocalStatus } from "../types";
import { DEFAULT_SETTINGS, apiFetch } from "../types";

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [localStatus, setLocalStatus] = useState<LocalStatus | null>(null);

  useEffect(() => {
    apiFetch<LocalStatus>("/api/local/status").then(setLocalStatus).catch(() => {});
  }, [verifyStatus]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const verifyConnection = async () => {
    setVerifying(true);
    setVerifyStatus(null);
    try {
      const result = await apiFetch<{ valid: boolean; error?: string; sample?: string }>(
        "/api/verify-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: settings.apiKey || "local",
            base_url: settings.baseUrl,
            model: settings.model,
          }),
        },
      );
      if (result.valid) {
        setVerifyStatus(`Connected — model responded: ${result.sample || "OK"}`);
      } else {
        setVerifyStatus(`Not connected: ${result.error || "unknown error"}`);
      }
    } catch (e) {
      setVerifyStatus(`Not connected: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVerifying(false);
    }
  };

  const applyDetectedModel = () => {
    const active = localStatus?.inference.active_model;
    if (active) onChange({ ...settings, model: active });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-2">Settings</h2>
      <p className="text-glm-muted text-sm mb-6">
        Runs locally on your PC via Ollama — no API key or internet required. Unlimited usage.
      </p>

      {localStatus && (
        <div
          className={`mb-6 p-4 rounded-xl border ${
            localStatus.ready
              ? "border-glm-success/40 bg-glm-success/5"
              : "border-glm-warn/40 bg-glm-warn/5"
          }`}
        >
          <p className="font-semibold text-sm mb-1">
            {localStatus.ready ? "Local inference ready" : "Ollama not detected"}
          </p>
          {localStatus.ready ? (
            <p className="text-xs text-glm-muted">
              Models: {localStatus.inference.ollama.models.slice(0, 5).join(", ") || "none"}
              {localStatus.inference.ollama.models.length > 5 ? "…" : ""}
            </p>
          ) : (
            <p className="text-xs text-glm-muted">
              {localStatus.setup_hint ||
                "Install Ollama from ollama.com, then run: ollama pull llama3.1:8b"}
            </p>
          )}
          {localStatus.usage_limits?.note && (
            <p className="text-xs text-glm-accent2 mt-2">{localStatus.usage_limits.note}</p>
          )}
        </div>
      )}

      <div className="space-y-5">
        <Field label="Local server URL" hint="Ollama OpenAI-compatible endpoint (default)">
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => update("baseUrl", e.target.value)}
            className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
          />
        </Field>

        <Field label="Model" hint="Any model installed in Ollama on this PC">
          <div className="flex gap-2">
            <input
              type="text"
              value={settings.model}
              onChange={(e) => update("model", e.target.value)}
              className="flex-1 rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
            />
            {localStatus?.inference.active_model && (
              <button
                type="button"
                onClick={applyDetectedModel}
                className="px-3 py-2 rounded-lg border border-glm-border text-xs hover:bg-glm-card"
              >
                Use detected
              </button>
            )}
          </div>
        </Field>

        <Field label="API key" hint="Not required for local Ollama — leave as 'local'">
          <input
            type="text"
            value={settings.apiKey}
            onChange={(e) => update("apiKey", e.target.value)}
            placeholder="local"
            className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
          />
        </Field>

        <Field label="System prompt">
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => update("systemPrompt", e.target.value)}
            rows={3}
            className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50 resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={`Temperature (${settings.temperature})`}>
            <input
              type="range"
              min={0.01}
              max={1}
              step={0.01}
              value={settings.temperature}
              onChange={(e) => update("temperature", parseFloat(e.target.value))}
              className="w-full"
            />
          </Field>

          <Field label="Max tokens (optional)">
            <input
              type="number"
              value={settings.maxTokens ?? ""}
              onChange={(e) =>
                update("maxTokens", e.target.value ? parseInt(e.target.value, 10) : null)
              }
              placeholder="No limit"
              className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={settings.stream}
            onChange={(e) => update("stream", e.target.checked)}
            className="rounded border-glm-border"
          />
          Stream responses
        </label>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={verifyConnection}
            disabled={verifying}
            className="px-4 py-2 rounded-lg border border-glm-border text-sm hover:bg-glm-card transition-colors disabled:opacity-50"
          >
            {verifying ? "Checking…" : "Test local connection"}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="px-4 py-2 rounded-lg border border-glm-border text-sm text-glm-muted hover:text-white transition-colors"
          >
            Reset defaults
          </button>
        </div>

        {verifyStatus && <p className="text-sm font-mono text-glm-muted">{verifyStatus}</p>}
      </div>

      <div className="mt-8 p-4 rounded-xl border border-glm-border bg-glm-card text-sm">
        <h3 className="font-semibold mb-2">One-time setup (this PC only)</h3>
        <pre className="text-xs font-mono text-glm-muted overflow-x-auto whitespace-pre-wrap">
{`# 1. Install Ollama — https://ollama.com
# 2. Pull a model (pick one):
ollama pull llama3.1:8b
ollama pull qwen2.5:14b

# 3. Start this app:
./start.sh

# Open http://localhost:8000 — unlimited local usage`}
        </pre>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {hint && <p className="text-xs text-glm-muted mb-2">{hint}</p>}
      {children}
    </div>
  );
}
