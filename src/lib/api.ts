import {
  getGeminiApiKey,
  getOpenAiApiKey,
  getProvider,
  getTrainingMessages,
  hasActiveApiKey,
} from "@/lib/ai-settings";

export const API_KEY_HEADER = "X-Gemini-Api-Key";
export const OPENAI_KEY_HEADER = "X-OpenAI-Api-Key";

export type CurateModel = "gemini-3.5-flash" | "gemini-3.5-pro";

export type StreamPass = "transcription" | "structure" | "single-pass";

export type LyricsPhase = "idle" | "transcription" | "structuring" | "done";

export type CurateStreamEvent =
  | { type: "status"; message: string }
  | {
      type: "pass_start";
      pass: StreamPass;
      model: string;
      message: string;
    }
  | { type: "chunk"; pass: StreamPass; text: string }
  | { type: "pass_end"; pass: StreamPass; draft?: string }
  | {
      type: "done";
      markdown: string;
      pipeline: string[];
      model: string;
      temperature: number;
      split_structure: boolean;
      compressed?: boolean;
      provider?: string;
    }
  | { type: "error"; message: string };

export interface CurateResponse {
  markdown: string;
  model: string;
  temperature: number;
  pipeline?: string[];
  split_structure?: boolean;
  compressed?: boolean;
}

function parseSseEvents(buffer: string): { events: CurateStreamEvent[]; rest: string } {
  const events: CurateStreamEvent[] = [];
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  for (const part of parts) {
    const line = part.trim();
    if (!line.startsWith("data:")) continue;
    try {
      events.push(JSON.parse(line.slice(5).trim()) as CurateStreamEvent);
    } catch {
      /* skip */
    }
  }
  return { events, rest };
}

export async function curateAudioStream(
  file: File,
  options: {
    model: CurateModel;
    temperature: number;
    userPrompt?: string;
    splitStructure?: boolean;
    onEvent: (event: CurateStreamEvent) => void;
  }
): Promise<CurateResponse> {
  if (!hasActiveApiKey()) {
    throw new Error("API key required. Open Settings and configure your AI provider.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("model", options.model);
  form.append("temperature", String(options.temperature));
  form.append("provider", getProvider());
  form.append(
    "split_structure",
    options.splitStructure === false ? "false" : "true"
  );
  form.append("training_messages", JSON.stringify(getTrainingMessages()));
  if (options.userPrompt?.trim()) {
    form.append("user_prompt", options.userPrompt.trim());
  }

  const headers: Record<string, string> = {};
  const gemini = getGeminiApiKey();
  const openai = getOpenAiApiKey();
  if (gemini) headers[API_KEY_HEADER] = gemini;
  if (openai) headers[OPENAI_KEY_HEADER] = openai;

  // Dynamically resolve API URL base for Android (Capacitor) webview
  let apiBase = "";
  if (
    typeof window !== "undefined" &&
    (window.location.origin.startsWith("capacitor://") ||
      window.location.origin === "http://localhost" ||
      window.location.protocol === "file:")
  ) {
    const customHost = localStorage.getItem("musica-custom-api-host");
    apiBase = customHost || "https://ais-dev-2py2nr7d52ngl3f6fxatdu-99924698939.asia-east1.run.app";
  }

  const res = await fetch(`${apiBase}/api/curate/stream`, {
    method: "POST",
    headers,
    body: form,
  });

  if (!res.ok) {
    const raw = await res.text();
    let detail = "";
    try {
      const err = JSON.parse(raw) as { detail?: unknown };
      if (typeof err.detail === "string") detail = err.detail;
      else if (err.detail != null) detail = JSON.stringify(err.detail);
    } catch {
      detail = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    if (!detail) {
      if (res.status === 413) {
        detail =
          "Upload too large for Vercel (max ~4 MB). Use a shorter track or let the app compress before upload.";
      } else if (res.status === 401) {
        detail = "API key missing or invalid. Check Settings.";
      } else if (res.status === 504) {
        detail = "Request timed out. Try a shorter track or disable split structure.";
      } else {
        detail = `Curation stream failed (HTTP ${res.status})`;
      }
    }
    throw new Error(detail);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream from server");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: CurateResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: true });
    }
    
    const { events, rest } = parseSseEvents(buffer);
    buffer = rest;
    
    for (const event of events) {
      options.onEvent(event);
      if (event.type === "error") throw new Error(event.message);
      if (event.type === "done") {
        result = {
          markdown: event.markdown,
          model: event.model,
          temperature: event.temperature,
          pipeline: event.pipeline,
          split_structure: event.split_structure,
          compressed: event.compressed,
        };
      }
    }

    if (done) {
      // Flush residual text decoder buffer
      const residual = decoder.decode();
      if (residual) {
        buffer += residual;
      }
      // Process some last event in the buffer
      if (buffer.trim()) {
        if (!buffer.endsWith("\n\n")) {
          buffer += "\n\n";
        }
        const { events: finalEvents } = parseSseEvents(buffer);
        for (const event of finalEvents) {
          options.onEvent(event);
          if (event.type === "error") throw new Error(event.message);
          if (event.type === "done") {
            result = {
              markdown: event.markdown,
              model: event.model,
              temperature: event.temperature,
              pipeline: event.pipeline,
              split_structure: event.split_structure,
              compressed: event.compressed,
            };
          }
        }
      }
      break;
    }
  }

  if (!result) {
    throw new Error(
      "Stream ended before curation finished (connection timeout or server error). Try again with a shorter track."
    );
  }
  return result;
}

