import { useEffect, useState } from "react";
import type { TabId } from "../types";
import { apiFetch } from "../types";

const NAV: { id: TabId; label: string; icon: string }[] = [
  { id: "agent", label: "Agent", icon: "🤖" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "terminal", label: "Terminal", icon: "⌨️" },
  { id: "gamestudio", label: "Game Studio", icon: "🎮" },
  { id: "pcbuilder", label: "PC Builder", icon: "🖥️" },
  { id: "creation", label: "AI Create", icon: "✨" },
  { id: "restrictions", label: "Restrictions", icon: "📋" },
  { id: "tests", label: "Tests", icon: "🧪" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

interface HeaderProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function Header({ activeTab, onTabChange }: HeaderProps) {
  const [model, setModel] = useState("local");
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    apiFetch<{ model: string; guard_mode: string; ready?: boolean; local_mode?: boolean }>(
      "/api/config",
    )
      .then((c) => {
        setModel(c.model);
        setLocalReady(c.ready ?? false);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-glm-surface/70 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-glm-accent to-glm-accent2 blur-md opacity-60" />
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-glm-accent to-glm-accent2 text-sm font-bold shadow-glm-glow">
              GLM
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-gradient">
              GLM-5.1 UI
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                  localReady
                    ? "bg-glm-success/15 text-glm-success ring-1 ring-glm-success/30"
                    : "bg-glm-warn/15 text-glm-warn ring-1 ring-glm-warn/30"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${localReady ? "bg-glm-success animate-pulse" : "bg-glm-warn"}`}
                />
                {localReady ? "Ready" : "Needs model"}
              </span>
              <span className="truncate text-xs text-glm-muted">{model}</span>
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-glm-card/60 p-1 shadow-glm-nav backdrop-blur-xl [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`group relative shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-glm-accent to-sky-500 text-white shadow-glm-glow"
                    : "text-glm-muted hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                <span className="mr-1.5">{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-px bg-white/40" aria-hidden />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
