import { useEffect, useState } from "react";
import type { TabId } from "../types";
import { apiFetch } from "../types";

const NAV: { id: TabId; label: string; icon: string }[] = [
  { id: "agent", label: "Agent", icon: "🤖" },
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "terminal", label: "Terminal", icon: "⌨️" },
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
    <header className="border-b border-glm-border bg-glm-surface/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-glm-accent to-glm-accent2 flex items-center justify-center font-bold text-sm shrink-0">
            GLM
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">
              GLM-5.1 UI
            </h1>
            <p className="text-xs text-glm-muted truncate">
              Agent · {model} · {localReady ? "ready" : "needs model"}
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-glm-card rounded-xl p-1 border border-glm-border">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === item.id
                  ? "bg-glm-accent text-white shadow-lg shadow-glm-accent/20"
                  : "text-glm-muted hover:text-white hover:bg-glm-border/50"
              }`}
            >
              <span className="mr-1.5">{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
