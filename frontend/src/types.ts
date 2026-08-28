export type TabId = "agent" | "chat" | "pcbuilder" | "creation" | "restrictions" | "tests" | "settings";

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
    model: "qwen2.5-coder:14b",
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
  model: "qwen2.5-coder:14b",
  temperature: 0.5,
  maxTokens: null,
  stream: true,
  thinkingEnabled: false,
  localMode: true,
  provider: "local",
  internetEnabled: false,
  systemPrompt: "", // empty = use trained backend prompt
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

/** Fields sent with API calls — includes user-approved external access flag. */
export function apiContext(settings: AppSettings): Record<string, unknown> {
  return {
    internet_enabled: settings.internetEnabled,
    api_key: settings.apiKey || undefined,
    base_url: settings.baseUrl || undefined,
    model: settings.model,
  };
}

export async function syncExternalAccess(enabled: boolean): Promise<void> {
  try {
    await apiFetch("/api/external-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ internet_enabled: enabled }),
    });
  } catch {
    /* backend may be offline during dev */
  }
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
