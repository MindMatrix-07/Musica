const PROMPT_KEY = "musica_user_prompt";

export function getStoredPrompt(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PROMPT_KEY) ?? "";
}

export function setStoredPrompt(prompt: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPT_KEY, prompt);
}
