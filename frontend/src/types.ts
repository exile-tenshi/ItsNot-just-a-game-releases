export type TabId = "chat" | "restrictions" | "tests" | "settings";

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
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: "",
  baseUrl: "https://api.z.ai/api/paas/v4/",
  model: "glm-5.1",
  temperature: 0.6,
  maxTokens: null,
  stream: true,
  thinkingEnabled: false,
  systemPrompt: "You are a helpful AI assistant powered by GLM-5.1.",
};

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
