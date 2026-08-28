import { useEffect, useState } from "react";
import { AgentPanel } from "./components/AgentPanel";
import { Header } from "./components/Header";
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

  useEffect(() => {
    void syncExternalAccess(settings.internetEnabled);
  }, []);

  const handleSettingsChange = (next: AppSettings) => {
    setSettings(next);
    localStorage.setItem("glm-5.1-settings", JSON.stringify(next));
    void syncExternalAccess(next.internetEnabled);
  };

  return (
    <div className="min-h-screen bg-glm-bg">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
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
  );
}
