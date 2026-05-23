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

type CurateOptions = {
  model: CurateModel;
  temperature: number;
  userPrompt?: string;
  splitStructure?: boolean;
  onEvent: (event: CurateStreamEvent) => void;
};

function buildCurateForm(file: File, options: CurateOptions): FormData {
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
  return form;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const gemini = getGeminiApiKey();
  const openai = getOpenAiApiKey();
  if (gemini) headers[API_KEY_HEADER] = gemini;
  if (openai) headers[OPENAI_KEY_HEADER] = openai;
  return headers;
}

function parseApiError(raw: string, status: number): string {
  let detail = "";
  try {
    const err = JSON.parse(raw) as { detail?: unknown };
    if (typeof err.detail === "string") detail = err.detail;
    else if (err.detail != null) detail = JSON.stringify(err.detail);
  } catch {
    detail = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  if (!detail) {
    if (status === 413) {
      detail =
        "Upload too large for Vercel (max ~4 MB). Use a shorter track or let the app compress before upload.";
    } else if (status === 401) {
      detail = "API key missing or invalid. Check Settings.";
    } else if (status === 504) {
      detail = "Request timed out. Try a shorter track or disable split structure.";
    } else {
      detail = `Request failed (HTTP ${status})`;
    }
  }
  return detail;
}

function isStreamInfraFailure(message: string, status: number): boolean {
  if (status >= 500) return true;
  return /FUNCTION_INVOCATION|server error has occurred|A server error/i.test(
    message
  );
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

/** Non-streaming fallback when SSE / serverless streaming fails on Vercel. */
async function curateAudioBatch(
  file: File,
  options: CurateOptions
): Promise<CurateResponse> {
  options.onEvent({
    type: "status",
    message:
      "Live stream unavailable on server — running full curation (may take several minutes)…",
  });
  options.onEvent({
    type: "pass_start",
    pass: "single-pass",
    model: options.model,
    message: `Curation (${options.model})`,
  });

  const res = await fetch("/api/curate", {
    method: "POST",
    headers: authHeaders(),
    body: buildCurateForm(file, options),
  });

  if (!res.ok) {
    const raw = await res.text();
    throw new Error(parseApiError(raw, res.status));
  }

  const data = (await res.json()) as CurateResponse & {
    pipeline?: string[];
    split_structure?: boolean;
    compressed?: boolean;
  };

  options.onEvent({
    type: "pass_end",
    pass: "single-pass",
    draft: data.markdown,
  });
  options.onEvent({
    type: "done",
    markdown: data.markdown,
    pipeline: data.pipeline ?? ["batch"],
    model: data.model,
    temperature: data.temperature,
    split_structure: data.split_structure ?? true,
    compressed: data.compressed,
  });

  return data;
}

async function curateAudioStreamLive(
  file: File,
  options: CurateOptions
): Promise<CurateResponse> {
  const res = await fetch("/api/curate/stream", {
    method: "POST",
    headers: authHeaders(),
    body: buildCurateForm(file, options),
  });

  if (!res.ok) {
    const raw = await res.text();
    const detail = parseApiError(raw, res.status);
    if (isStreamInfraFailure(detail, res.status)) {
      return curateAudioBatch(file, options);
    }
    throw new Error(detail);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response stream from server");

  const decoder = new TextDecoder();
  let buffer = "";
  let result: CurateResponse | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
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
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isStreamInfraFailure(msg, 0)) {
      return curateAudioBatch(file, options);
    }
    throw e;
  }

  if (!result) {
    return curateAudioBatch(file, options);
  }
  return result;
}

export async function curateAudioStream(
  file: File,
  options: CurateOptions
): Promise<CurateResponse> {
  if (!hasActiveApiKey()) {
    throw new Error("API key required. Open Settings and configure your AI provider.");
  }

  try {
    return await curateAudioStreamLive(file, options);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isStreamInfraFailure(msg, 0)) {
      return curateAudioBatch(file, options);
    }
    throw e;
  }
}
