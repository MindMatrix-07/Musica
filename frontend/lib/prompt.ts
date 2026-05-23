const STORAGE_KEY = "musica_user_prompt";

export function getStoredPrompt(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(STORAGE_KEY) ?? "";
}

export function setStoredPrompt(value: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, value);
}
