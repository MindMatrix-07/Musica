import { getApiKey } from "@/lib/settings";

export const API_KEY_HEADER = "X-Gemini-Api-Key";

export type CurateModel = "gemini-3.5-flash" | "gemini-1.5-pro";

export type StreamPass = "transcription" | "structure" | "single-pass";

export type CurateStreamEvent =
  | { type: "status"; message: string }
  | {
      type: "pass_start";
      pass: StreamPass;
      model: string;
      message: string;
    }
  | { type: "chunk"; pass: StreamPass; text: string }
  | { type: "pass_end"; pass: StreamPass; preview?: string }
  | {
      type: "done";
      markdown: string;
      pipeline: string[];
      model: string;
      temperature: number;
      split_structure: boolean;
      compressed?: boolean;
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
      /* skip malformed */
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
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key required. Open Settings and add your key."
    );
  }

  const form = new FormData();
  form.append("file", file);
  form.append("model", options.model);
  form.append("temperature", String(options.temperature));
  form.append(
    "split_structure",
    options.splitStructure === false ? "false" : "true"
  );
  if (options.userPrompt?.trim()) {
    form.append("user_prompt", options.userPrompt.trim());
  }

  const res = await fetch("/api/curate/stream", {
    method: "POST",
    headers: { [API_KEY_HEADER]: apiKey },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail =
      typeof err.detail === "string"
        ? err.detail
        : JSON.stringify(err.detail ?? err);
    throw new Error(detail || "Curation stream failed");
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream from server");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: CurateResponse | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const { events, rest } = parseSseEvents(buffer);
    buffer = rest;
    for (const event of events) {
      options.onEvent(event);
      if (event.type === "error") {
        throw new Error(event.message);
      }
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

  if (!result) {
    throw new Error("Stream ended without a result");
  }
  return result;
}

/** @deprecated Use curateAudioStream for live updates */
export async function curateAudio(
  file: File,
  options: {
    model: CurateModel;
    temperature: number;
    userPrompt?: string;
    splitStructure?: boolean;
    onProgress?: (percent: number) => void;
  }
): Promise<CurateResponse> {
  let progress = 15;
  return curateAudioStream(file, {
    model: options.model,
    temperature: options.temperature,
    userPrompt: options.userPrompt,
    splitStructure: options.splitStructure,
    onEvent: (e) => {
      if (e.type === "chunk") progress = Math.min(95, progress + 1);
      if (e.type === "pass_end") progress = Math.min(90, progress + 10);
      if (e.type === "status") progress = Math.min(85, progress + 2);
      options.onProgress?.(progress);
    },
  });
}
