import { useEffect, useState } from "react";
import { AgentPanel } from "./components/AgentPanel";
import { Sidebar, TopBar } from "./components/Sidebar";
import { ChatPanel } from "./components/ChatPanel";
import { RestrictionsPanel } from "./components/RestrictionsPanel";
import { TestSuitePanel } from "./components/TestSuitePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { PCBuilderPanel } from "./components/PCBuilderPanel";
import { CreationPanel } from "./components/CreationPanel";
import { GameStudioPanel } from "./components/GameStudioPanel";
import { TerminalPanel } from "./components/TerminalPanel";
import type { AppSettings, TabId } from "./types";
import { DEFAULT_SETTINGS, syncExternalAccess } from "./types";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem("glm-5.1-settings");
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("agent");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    void syncExternalAccess(settings.internetEnabled);
  }, []);

  const handleSettingsChange = (next: AppSettings) => {
    setSettings(next);
    localStorage.setItem("glm-5.1-settings", JSON.stringify(next));
    void syncExternalAccess(next.internetEnabled);
  };

  return (
    <div className="min-h-screen relative">
      <div className="ambient-bg" aria-hidden />
      <div className="ambient-orb w-[480px] h-[480px] bg-glm-accent/20 -top-48 -left-48" aria-hidden />
      <div className="ambient-orb w-[360px] h-[360px] bg-glm-accent2/15 top-1/3 -right-32" aria-hidden />

      <div className="relative flex min-h-screen">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <TopBar activeTab={activeTab} onMenuOpen={() => setMobileNavOpen(true)} />

          <main className="flex-1 animate-fade-in">
            {activeTab === "agent" && <AgentPanel settings={settings} />}
            {activeTab === "chat" && <ChatPanel settings={settings} />}
            {activeTab === "terminal" && <TerminalPanel />}
            {activeTab === "gamestudio" && <GameStudioPanel settings={settings} />}
            {activeTab === "pcbuilder" && <PCBuilderPanel settings={settings} />}
            {activeTab === "creation" && (
              <CreationPanel onNavigate={(tab) => setActiveTab(tab)} />
            )}
            {activeTab === "restrictions" && <RestrictionsPanel />}
            {activeTab === "tests" && <TestSuitePanel />}
            {activeTab === "settings" && (
              <SettingsPanel settings={settings} onChange={handleSettingsChange} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
