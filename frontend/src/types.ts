export type TabId = "agent" | "chat" | "pcbuilder" | "restrictions" | "tests" | "settings";

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

export type ProviderId = "local" | "zai" | "openai" | "openrouter";

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
  provider: ProviderId;
  internetEnabled: boolean;
}

export const PROVIDERS: Record<
  ProviderId,
  { label: string; baseUrl: string; model: string; apiKey: string }
> = {
  local: {
    label: "Local (Ollama)",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.1:8b",
    apiKey: "local",
  },
  zai: {
    label: "Z.AI GLM-5.1",
    baseUrl: "https://api.z.ai/api/paas/v4/",
    model: "glm-5.1",
    apiKey: "",
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    apiKey: "",
  },
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "anthropic/claude-sonnet-4",
    apiKey: "",
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "local",
  baseUrl: "http://127.0.0.1:11434/v1",
  model: "llama3.1:8b",
  temperature: 0.6,
  maxTokens: null,
  stream: true,
  thinkingEnabled: false,
  localMode: true,
  provider: "local",
  internetEnabled: true,
  systemPrompt:
    "You are an expert AI coding assistant with access to the workspace, terminal, git, and the internet.",
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
