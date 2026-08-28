import { useState } from "react";
import { Header } from "./components/Header";
import { ChatPanel } from "./components/ChatPanel";
import { RestrictionsPanel } from "./components/RestrictionsPanel";
import { TestSuitePanel } from "./components/TestSuitePanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { PCBuilderPanel } from "./components/PCBuilderPanel";
import type { AppSettings, TabId } from "./types";
import { DEFAULT_SETTINGS } from "./types";

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
  const [activeTab, setActiveTab] = useState<TabId>("chat");
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  const handleSettingsChange = (next: AppSettings) => {
    setSettings(next);
    localStorage.setItem("glm-5.1-settings", JSON.stringify(next));
  };

  return (
    <div className="min-h-screen bg-glm-bg">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main>
        {activeTab === "chat" && <ChatPanel settings={settings} />}
        {activeTab === "pcbuilder" && <PCBuilderPanel settings={settings} />}
        {activeTab === "restrictions" && <RestrictionsPanel />}
        {activeTab === "tests" && <TestSuitePanel />}
        {activeTab === "settings" && (
          <SettingsPanel settings={settings} onChange={handleSettingsChange} />
        )}
      </main>
    </div>
  );
}
