export type TabId = "chat" | "pcbuilder" | "restrictions" | "tests" | "settings";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface Violation {
  category_id: string;
  label: string;
  description?: string;
  severity: string;
  matched_keyword: string;
  terms_section?: string;
}

export interface AppSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number | null;
  stream: boolean;
  thinkingEnabled: boolean;
  systemPrompt: string;
  localMode: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "local",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "llama3.1:8b",
  temperature: 0.6,
  maxTokens: null,
  stream: true,
  thinkingEnabled: false,
  localMode: true,
  systemPrompt:
    "You are a helpful AI assistant running locally on the user's PC. No usage limits apply.",
};

export interface LocalStatus {
  local_mode: boolean;
  ready: boolean;
  setup_hint?: string | null;
  usage_limits: {
    enabled?: boolean;
    max_requests_per_minute?: number;
    note?: string;
  };
  inference: {
    base_url: string;
    active_model: string;
    ollama: {
      reachable: boolean;
      models: string[];
    };
  };
}

export interface PCBuildPreset {
  id: string;
  name: string;
  budget_usd: number;
  tier: string;
  target: string;
  highlights: string[];
  prompt: string;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  if (!res.ok) {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      throw new Error(json.detail ? JSON.stringify(json.detail) : text);
    } catch {
      throw new Error(text || res.statusText);
    }
  }
  return res.json() as Promise<T>;
}
