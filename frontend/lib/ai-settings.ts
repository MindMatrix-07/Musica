export type AiProvider = "gemini" | "openai";

const KEYS = {
  gemini: "musica_gemini_api_key",
  openai: "musica_openai_api_key",
  provider: "musica_ai_provider",
  training: "musica_training_messages",
} as const;

function notify(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("musica-settings-updated"));
  }
}

export function getProvider(): AiProvider {
  if (typeof window === "undefined") return "gemini";
  const v = localStorage.getItem(KEYS.provider);
  return v === "openai" ? "openai" : "gemini";
}

export function setProvider(provider: AiProvider): void {
  localStorage.setItem(KEYS.provider, provider);
  notify();
}

export function getGeminiApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.gemini)?.trim() || null;
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(KEYS.gemini, key.trim());
  notify();
}

export function getOpenAiApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEYS.openai)?.trim() || null;
}

export function setOpenAiApiKey(key: string): void {
  localStorage.setItem(KEYS.openai, key.trim());
  notify();
}

export function clearGeminiApiKey(): void {
  localStorage.removeItem(KEYS.gemini);
  notify();
}

export function clearOpenAiApiKey(): void {
  localStorage.removeItem(KEYS.openai);
  notify();
}

export function hasActiveApiKey(): boolean {
  return getProvider() === "openai"
    ? Boolean(getOpenAiApiKey())
    : Boolean(getGeminiApiKey());
}

export function getTrainingMessages(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS.training);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function setTrainingMessages(messages: string[]): void {
  localStorage.setItem(KEYS.training, JSON.stringify(messages));
  notify();
}

export function addTrainingMessage(message: string): void {
  const trimmed = message.trim();
  if (!trimmed) return;
  const list = getTrainingMessages();
  list.push(trimmed);
  setTrainingMessages(list);
}

export function removeTrainingMessage(index: number): void {
  const list = getTrainingMessages();
  list.splice(index, 1);
  setTrainingMessages(list);
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
