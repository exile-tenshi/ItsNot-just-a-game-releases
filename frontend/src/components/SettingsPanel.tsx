import { useState, type ReactNode } from "react";
import type { AppSettings } from "../types";
import { DEFAULT_SETTINGS, apiFetch } from "../types";

interface SettingsPanelProps {
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const verifyKey = async () => {
    setVerifying(true);
    setVerifyStatus(null);
    try {
      const result = await apiFetch<{ valid: boolean; error?: string; sample?: string }>(
        "/api/verify-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: settings.apiKey,
            base_url: settings.baseUrl,
          }),
        },
      );
      if (result.valid) {
        setVerifyStatus(`✓ Valid — sample: ${result.sample || "OK"}`);
      } else {
        setVerifyStatus(`✗ ${result.error || "Invalid key"}`);
      }
    } catch (e) {
      setVerifyStatus(`✗ ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-2">Settings</h2>
      <p className="text-glm-muted text-sm mb-6">
        Configure the official OpenAI SDK connection to Z.AI for GLM-5.1.
      </p>

      <div className="space-y-5">
        <Field label="API Key" hint="From https://z.ai/manage-apikey/apikey-list">
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => update("apiKey", e.target.value)}
            placeholder="Z.AI API key"
            className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
          />
        </Field>

        <Field label="Base URL" hint="Official Z.AI OpenAI-compatible endpoint">
          <input
            type="text"
            value={settings.baseUrl}
            onChange={(e) => update("baseUrl", e.target.value)}
            className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50 font-mono text-sm"
          />
        </Field>

        <Field label="Model">
          <input
            type="text"
            value={settings.model}
            onChange={(e) => update("model", e.target.value)}
            className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50 font-mono text-sm"
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
                update(
                  "maxTokens",
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              placeholder="No limit"
              className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.stream}
              onChange={(e) => update("stream", e.target.checked)}
              className="rounded border-glm-border"
            />
            Stream responses
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.thinkingEnabled}
              onChange={(e) => update("thinkingEnabled", e.target.checked)}
              className="rounded border-glm-border"
            />
            Thinking mode
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={verifyKey}
            disabled={verifying || !settings.apiKey}
            className="px-4 py-2 rounded-lg border border-glm-border text-sm hover:bg-glm-card transition-colors disabled:opacity-50"
          >
            {verifying ? "Verifying…" : "Verify API Key"}
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_SETTINGS, apiKey: settings.apiKey })}
            className="px-4 py-2 rounded-lg border border-glm-border text-sm text-glm-muted hover:text-white transition-colors"
          >
            Reset defaults
          </button>
        </div>

        {verifyStatus && (
          <p className="text-sm font-mono text-glm-muted">{verifyStatus}</p>
        )}
      </div>

      <div className="mt-8 p-4 rounded-xl border border-glm-border bg-glm-card text-sm">
        <h3 className="font-semibold mb-2">SDK reference</h3>
        <pre className="text-xs font-mono text-glm-muted overflow-x-auto">
{`from openai import OpenAI

client = OpenAI(
    api_key="your-Z.AI-api-key",
    base_url="https://api.z.ai/api/paas/v4/"
)

response = client.chat.completions.create(
    model="glm-5.1",
    messages=[{"role": "user", "content": "Hello"}]
)`}
        </pre>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {hint && <p className="text-xs text-glm-muted mb-2">{hint}</p>}
      {children}
    </div>
  );
}