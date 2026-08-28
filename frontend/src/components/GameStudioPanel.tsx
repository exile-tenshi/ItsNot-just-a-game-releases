import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "../types";
import { apiContext, apiFetch } from "../types";

interface GamePreset {
  id: string;
  name: string;
  genre: string;
  features: string[];
  includes: string[];
  prompt: string;
}

interface PresetsData {
  presets: GamePreset[];
  quick_prompts: string[];
  capability_areas: string[];
}

interface GameProject {
  slug: string;
  name: string;
  genre?: string;
  features?: string[];
  multiplayer?: boolean;
}

interface GameStudioPanelProps {
  settings: AppSettings;
}

export function GameStudioPanel({ settings }: GameStudioPanelProps) {
  const [presets, setPresets] = useState<PresetsData | null>(null);
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [gameName, setGameName] = useState("My Adventure");
  const [genre, setGenre] = useState("open-world");
  const [multiplayer, setMultiplayer] = useState(false);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadProjects = () => {
    apiFetch<{ projects: GameProject[] }>("/api/game-studio/projects")
      .then((d) => setProjects(d.projects))
      .catch(() => {});
  };

  useEffect(() => {
    apiFetch<PresetsData>("/api/game-studio/presets").then(setPresets).catch(() => {});
    loadProjects();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [output]);

  const quickCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ slug: string; files_written: string[] }>(
        "/api/game-studio/create",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: gameName,
            genre,
            dimension: "3d",
            features: ["exploration", "combat"],
            with_terrain: true,
            with_map: true,
            with_roads: true,
            with_multiplayer: multiplayer,
          }),
        },
      );
      setOutput(`Created game: ${result.slug}\nFiles: ${result.files_written?.join(", ")}\n\nPlay: /games/${result.slug}/index.html`);
      loadProjects();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const runDesign = async (presetId?: string, customPrompt?: string) => {
    setLoading(true);
    setError(null);
    setOutput("");
    try {
      const res = await fetch("/api/game-studio/design/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset_id: presetId,
          extras: customPrompt || "",
          stream: true,
          temperature: 0.7,
          ...apiContext(settings),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
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
            if (parsed.content) setOutput((o) => o + parsed.content);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
      loadProjects();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h2 className="text-2xl font-semibold mb-2">Game Studio</h2>
      <p className="text-sm text-glm-muted mb-6">
        Create video games from scratch — characters, gameplay, multiplayer, 3D models, textures,
        terrain, roads, maps. Playable Three.js games in your browser.
      </p>

      {presets?.capability_areas && (
        <div className="flex flex-wrap gap-2 mb-6">
          {presets.capability_areas.map((c) => (
            <span key={c} className="text-xs px-2 py-1 rounded-full bg-glm-card border border-glm-border">
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-glm-border bg-glm-card p-5 space-y-4">
          <h3 className="font-semibold">Quick create (instant)</h3>
          <input
            value={gameName}
            onChange={(e) => setGameName(e.target.value)}
            placeholder="Game name"
            className="w-full rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm"
          />
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full rounded-lg bg-glm-bg border border-glm-border px-3 py-2 text-sm"
          >
            <option value="open-world">Open World</option>
            <option value="fps">FPS</option>
            <option value="rpg">RPG</option>
            <option value="racing">Racing</option>
            <option value="sandbox">Sandbox</option>
            <option value="multiplayer-arena">Multiplayer Arena</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={multiplayer} onChange={(e) => setMultiplayer(e.target.checked)} />
            Include multiplayer server
          </label>
          <button
            type="button"
            onClick={quickCreate}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-glm-accent to-glm-accent2 font-semibold text-sm disabled:opacity-50"
          >
            Create playable game
          </button>
        </div>

        <div className="rounded-xl border border-glm-border bg-glm-card p-5">
          <h3 className="font-semibold mb-3">Your games</h3>
          {projects.length === 0 ? (
            <p className="text-sm text-glm-muted">No games yet — create one!</p>
          ) : (
            <ul className="space-y-2">
              {projects.map((p) => (
                <li key={p.slug} className="flex justify-between items-center text-sm border-b border-glm-border pb-2">
                  <span>{p.name} <span className="text-glm-muted">({p.genre})</span></span>
                  <a
                    href={`/games/${p.slug}/index.html`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-glm-accent text-xs hover:underline"
                  >
                    Play →
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h3 className="font-semibold mb-3">AI game design presets</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {presets?.presets.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={loading}
            onClick={() => runDesign(p.id)}
            className="text-left p-4 rounded-xl border border-glm-border bg-glm-card hover:border-glm-accent transition-colors disabled:opacity-50"
          >
            <p className="font-medium">{p.name}</p>
            <p className="text-xs text-glm-muted mt-1">{p.includes.join(" · ")}</p>
          </button>
        ))}
      </div>

      {presets?.quick_prompts && (
        <div className="flex flex-wrap gap-2 mb-6">
          {presets.quick_prompts.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => runDesign(undefined, q)}
              className="text-xs px-3 py-2 rounded-lg border border-glm-border text-glm-muted hover:text-white disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {output && (
        <div className="rounded-xl border border-glm-border bg-glm-bg p-4 text-sm whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
          {output}
        </div>
      )}
      <div ref={bottomRef} />
      {loading && <p className="text-glm-muted text-sm mt-4 animate-pulse">Working…</p>}
    </div>
  );
}
