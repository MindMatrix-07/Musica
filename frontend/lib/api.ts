import { getApiKey } from "@/lib/settings";

export type CurateModel = "gemini-3.5-flash" | "gemini-1.5-pro";

export const API_KEY_HEADER = "X-Gemini-Api-Key";

export interface CurateResponse {
  markdown: string;
  model: string;
  temperature: number;
}

export async function curateAudio(
  file: File,
  options: {
    model: CurateModel;
    temperature: number;
    userPrompt?: string;
    onProgress?: (percent: number) => void;
  }
): Promise<CurateResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("model", options.model);
  form.append("temperature", String(options.temperature));
  if (options.userPrompt?.trim()) {
    form.append("user_prompt", options.userPrompt.trim());
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key required. Open Settings and add your key."
    );
  }

  options.onProgress?.(10);

  const res = await fetch("/api/curate", {
    method: "POST",
    headers: {
      [API_KEY_HEADER]: apiKey,
    },
    body: form,
  });

  options.onProgress?.(90);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail =
      typeof err.detail === "string"
        ? err.detail
        : JSON.stringify(err.detail ?? err);
    throw new Error(detail || "Curation request failed");
  }

  options.onProgress?.(100);
  return res.json() as Promise<CurateResponse>;
}
