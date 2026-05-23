const STORAGE_KEY = "musica_gemini_api_key";

export function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(STORAGE_KEY);
  return value?.trim() || null;
}

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("musica-settings-updated"));
  }
}

export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key.trim());
  notifyChange();
}

export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
  notifyChange();
}

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}
