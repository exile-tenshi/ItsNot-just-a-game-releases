import { useEffect, useRef, useState } from "react";
import type { AppSettings, PCBuildPreset } from "../types";
import { apiContext, apiFetch } from "../types";

interface PCBuilderPanelProps {
  settings: AppSettings;
}

interface PresetsData {
  builds: PCBuildPreset[];
  resolutions: { id: string; label: string }[];
  use_cases: { id: string; label: string; icon: string }[];
  quick_prompts: string[];
}

export function PCBuilderPanel({ settings }: PCBuilderPanelProps) {
  const [presets, setPresets] = useState<PresetsData | null>(null);
  const [budget, setBudget] = useState(2000);
  const [resolution, setResolution] = useState("1440p");
  const [useCase, setUseCase] = useState("aaa-gaming");
  const [extras, setExtras] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<PresetsData>("/api/pc-builder/presets").then(setPresets).catch(() => {});
  }, []);

  useEffect(() => {
    outputRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [output]);

  const runBuild = async (presetId?: string, customPrompt?: string) => {
    setLoading(true);
    setError(null);
    setOutput("");
    setSelectedPreset(presetId ?? null);

    const body: Record<string, unknown> = {
      stream: true,
      temperature: 0.7,
      ...apiContext(settings),
    };

    if (presetId) {
      body.preset_id = presetId;
      body.extras = extras;
    } else if (customPrompt) {
      body.extras = customPrompt;
    } else {
      body.budget_usd = budget;
      body.resolution = resolution;
      body.use_case = useCase;
      body.extras = extras;
    }

    try {
      const res = await fetch("/api/pc-builder/build/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

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
            if (parsed.content) setOutput((prev) => prev + parsed.content);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const tierColors: Record<string, string> = {
    budget: "text-glm-accent2",
    mid: "text-glm-accent",
    high: "text-purple-400",
    enthusiast: "text-orange-400",
    ultimate: "text-yellow-400",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Gaming PC Builder</h2>
        <p className="text-glm-muted text-sm mt-1">
          Unlimited local builds — from budget 1080p to no-compromise 4K enthusiast rigs. Runs
          entirely on your PC.
        </p>
      </div>

      {/* Preset cards */}
      {presets && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {presets.builds.map((build) => (
            <button
              key={build.id}
              type="button"
              onClick={() => runBuild(build.id)}
              disabled={loading}
              className={`text-left p-4 rounded-xl border transition-all hover:scale-[1.02] disabled:opacity-50 ${
                selectedPreset === build.id
                  ? "border-glm-accent bg-glm-accent/10"
                  : "border-glm-border bg-glm-card hover:border-glm-accent/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold uppercase ${tierColors[build.tier] || "text-glm-muted"}`}>
                  {build.tier}
                </span>
                <span className="text-lg font-bold">${build.budget_usd.toLocaleString()}</span>
              </div>
              <h3 className="font-semibold text-white mb-1">{build.name}</h3>
              <p className="text-xs text-glm-muted mb-2">{build.target}</p>
              <ul className="text-[10px] text-glm-muted space-y-0.5">
                {build.highlights.map((h) => (
                  <li key={h}>• {h}</li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      )}

      {/* Custom builder */}
      <div className="bg-glm-card border border-glm-border rounded-2xl p-6 mb-6">
        <h3 className="font-semibold mb-4">Custom Build</h3>
        <div className="grid gap-4 sm:grid-cols-3 mb-4">
          <div>
            <label className="text-xs text-glm-muted block mb-2">
              Budget: ${budget.toLocaleString()}
            </label>
            <input
              type="range"
              min={500}
              max={8000}
              step={100}
              value={budget}
              onChange={(e) => setBudget(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-glm-muted block mb-2">Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="w-full rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm"
            >
              {presets?.resolutions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-glm-muted block mb-2">Use case</label>
            <select
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
              className="w-full rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm"
            >
              {presets?.use_cases.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.icon} {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <textarea
          value={extras}
          onChange={(e) => setExtras(e.target.value)}
          placeholder="Extra requirements (e.g. must fit in desk, prefer NVIDIA, already have 850W PSU…)"
          rows={2}
          className="w-full rounded-xl bg-glm-bg border border-glm-border px-4 py-3 text-sm mb-4 resize-none focus:outline-none focus:ring-2 focus:ring-glm-accent/50"
        />
        <button
          type="button"
          onClick={() => runBuild()}
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-glm-accent to-glm-accent2 font-semibold text-sm disabled:opacity-50"
        >
          {loading ? "Building…" : "Generate Custom Build"}
        </button>
      </div>

      {/* Quick prompts */}
      {presets && (
        <div className="flex flex-wrap gap-2 mb-6">
          {presets.quick_prompts.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => runBuild(undefined, q)}
              disabled={loading}
              className="text-xs px-3 py-2 rounded-lg border border-glm-border bg-glm-card text-glm-muted hover:text-white hover:border-glm-accent transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Output */}
      {(output || loading || error) && (
        <div className="bg-glm-card border border-glm-border rounded-2xl p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            Build Recommendation
            {loading && (
              <span className="text-xs text-glm-accent animate-pulse">generating…</span>
            )}
          </h3>
          {error && (
            <pre className="text-sm text-glm-danger whitespace-pre-wrap font-mono mb-4">{error}</pre>
          )}
          <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
            {output}
          </div>
          <div ref={outputRef} />
        </div>
      )}
    </div>
  );
}
