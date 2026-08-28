import { useEffect, useState } from "react";
import type { TabId } from "../types";
import { apiFetch } from "../types";

type NavGroup = {
  title: string;
  items: { id: TabId; label: string; icon: string; desc?: string }[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { id: "agent", label: "Agent", icon: "⚡", desc: "Autonomous coding" },
      { id: "chat", label: "Chat", icon: "💬", desc: "Conversation" },
      { id: "terminal", label: "Terminal", icon: "⌨️", desc: "Run commands" },
    ],
  },
  {
    title: "Create",
    items: [
      { id: "gamestudio", label: "Game Studio", icon: "🎮", desc: "Build games" },
      { id: "pcbuilder", label: "PC Builder", icon: "🖥️", desc: "Rig advisor" },
      { id: "creation", label: "AI Create", icon: "✨", desc: "All modalities" },
    ],
  },
  {
    title: "System",
    items: [
      { id: "restrictions", label: "Restrictions", icon: "🛡️", desc: "Guard rules" },
      { id: "tests", label: "Tests", icon: "🧪", desc: "Test suite" },
      { id: "settings", label: "Settings", icon: "⚙️", desc: "Preferences" },
    ],
  },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ activeTab, onTabChange, mobileOpen, onMobileClose }: SidebarProps) {
  const [model, setModel] = useState("local");
  const [localReady, setLocalReady] = useState(false);

  useEffect(() => {
    apiFetch<{ model: string; ready?: boolean }>("/api/config")
      .then((c) => {
        setModel(c.model);
        setLocalReady(c.ready ?? false);
      })
      .catch(() => {});
  }, []);

  const handleNav = (tab: TabId) => {
    onTabChange(tab);
    onMobileClose();
  };

  const navContent = (
    <>
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-glm-accent to-glm-accent2 blur-md opacity-50" />
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-glm-accent to-glm-accent2 flex items-center justify-center font-display font-bold text-sm shadow-glow-sm">
              G
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-lg tracking-tight leading-tight">
              GLM-5.1
            </h1>
            <p className="text-[11px] text-glm-muted truncate">Coding Agent UI</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="section-title">{group.title}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleNav(item.id)}
                      className={`nav-item ${active ? "nav-item-active" : ""}`}
                    >
                      <span className="text-base w-6 text-center shrink-0">{item.icon}</span>
                      <span className="flex-1 text-left min-w-0">
                        <span className="block truncate">{item.label}</span>
                        {item.desc && (
                          <span className="block text-[10px] text-glm-muted/70 truncate font-normal">
                            {item.desc}
                          </span>
                        )}
                      </span>
                      {active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-glm-accent2 shrink-0 animate-pulse" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-white/[0.06]">
        <div className="glass-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wider text-glm-muted">Model</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                localReady
                  ? "bg-glm-success/15 text-glm-success"
                  : "bg-glm-warn/15 text-glm-warn"
              }`}
            >
              {localReady ? "Ready" : "Setup"}
            </span>
          </div>
          <p className="text-xs font-mono text-white/90 truncate" title={model}>
            {model}
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 glass-panel border-r border-white/[0.06] h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col glass-panel border-r border-white/[0.06] transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}

/** Compact top bar for mobile + page context */
export function TopBar({
  activeTab,
  onMenuOpen,
}: {
  activeTab: TabId;
  onMenuOpen: () => void;
}) {
  const label =
    NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label ?? "GLM-5.1";

  return (
    <header className="lg:hidden sticky top-0 z-30 glass-panel border-b border-white/[0.06] px-4 py-3 flex items-center gap-3">
      <button
        type="button"
        onClick={onMenuOpen}
        className="p-2 rounded-xl hover:bg-white/[0.06] text-glm-muted hover:text-white transition-colors"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-glm-accent to-glm-accent2 flex items-center justify-center font-bold text-xs shrink-0">
          G
        </div>
        <span className="font-display font-semibold truncate">{label}</span>
      </div>
    </header>
  );
}
