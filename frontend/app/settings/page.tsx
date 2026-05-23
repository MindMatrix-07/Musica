"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  addTrainingMessage,
  clearGeminiApiKey,
  clearOpenAiApiKey,
  getGeminiApiKey,
  getOpenAiApiKey,
  getProvider,
  getTrainingMessages,
  maskApiKey,
  setGeminiApiKey,
  setOpenAiApiKey,
  setProvider,
  removeTrainingMessage,
  type AiProvider,
} from "@/lib/ai-settings";

export default function SettingsPage() {
  const [provider, setProviderState] = useState<AiProvider>("gemini");
  const [geminiInput, setGeminiInput] = useState("");
  const [openaiInput, setOpenaiInput] = useState("");
  const [geminiMasked, setGeminiMasked] = useState<string | null>(null);
  const [openaiMasked, setOpenaiMasked] = useState<string | null>(null);
  const [trainingInput, setTrainingInput] = useState("");
  const [trainingList, setTrainingList] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => {
    setProviderState(getProvider());
    const g = getGeminiApiKey();
    const o = getOpenAiApiKey();
    setGeminiMasked(g ? maskApiKey(g) : null);
    setOpenaiMasked(o ? maskApiKey(o) : null);
    setTrainingList(getTrainingMessages());
  };

  useEffect(() => {
    refresh();
  }, []);

  const saveGemini = () => {
    if (!geminiInput.trim()) {
      setMessage("Enter a Gemini API key.");
      return;
    }
    setGeminiApiKey(geminiInput);
    setGeminiInput("");
    refresh();
    setMessage("Gemini key saved.");
  };

  const saveOpenai = () => {
    if (!openaiInput.trim()) {
      setMessage("Enter an OpenAI API key.");
      return;
    }
    setOpenAiApiKey(openaiInput);
    setOpenaiInput("");
    refresh();
    setMessage("OpenAI key saved.");
  };

  const addTraining = () => {
    addTrainingMessage(trainingInput);
    setTrainingInput("");
    refresh();
    setMessage("Training note added — applied to every curation.");
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <AppHeader />

      <div className="space-y-6">
        <div className="glass-panel p-6">
          <h2 className="text-lg font-medium text-foreground">AI provider</h2>
          <p className="mt-2 text-sm text-foreground/50">
            Choose which service curates your tracks. Keys stay in this browser only.
          </p>
          <div className="mt-4 flex gap-3">
            {(["gemini", "openai"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setProvider(p);
                  setProviderState(p);
                  setMessage(`Provider set to ${p === "gemini" ? "Google Gemini" : "OpenAI"}.`);
                }}
                className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition ${
                  provider === p
                    ? "border-accent bg-accent/20 text-foreground"
                    : "border-surface-border text-foreground/60 hover:border-white/20"
                }`}
              >
                {p === "gemini" ? "Google Gemini" : "OpenAI"}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-lg font-medium text-foreground">Gemini API key</h2>
          <p className="mt-2 text-sm text-foreground/50">
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-accent underline"
            >
              Google AI Studio
            </a>
          </p>
          {geminiMasked && (
            <p className="mt-3 font-mono text-xs text-foreground/70">
              Saved: {geminiMasked}
            </p>
          )}
          <input
            type="password"
            value={geminiInput}
            onChange={(e) => setGeminiInput(e.target.value)}
            placeholder="GEMINI_API_KEY"
            className="mt-3 w-full rounded-xl border border-surface-border bg-surface px-4 py-3 font-mono text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveGemini}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Save
            </button>
            {geminiMasked && (
              <button
                type="button"
                onClick={() => {
                  clearGeminiApiKey();
                  refresh();
                }}
                className="rounded-xl border border-surface-border px-4 py-2 text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-lg font-medium text-foreground">OpenAI API key</h2>
          <p className="mt-2 text-sm text-foreground/50">
            Optional — Whisper transcription + GPT-4o structure pass.
          </p>
          {openaiMasked && (
            <p className="mt-3 font-mono text-xs text-foreground/70">
              Saved: {openaiMasked}
            </p>
          )}
          <input
            type="password"
            value={openaiInput}
            onChange={(e) => setOpenaiInput(e.target.value)}
            placeholder="OPENAI_API_KEY"
            className="mt-3 w-full rounded-xl border border-surface-border bg-surface px-4 py-3 font-mono text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveOpenai}
              className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
            >
              Save
            </button>
            {openaiMasked && (
              <button
                type="button"
                onClick={() => {
                  clearOpenAiApiKey();
                  refresh();
                }}
                className="rounded-xl border border-surface-border px-4 py-2 text-sm"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="glass-panel p-6">
          <h2 className="text-lg font-medium text-foreground">
            Train with your messages
          </h2>
          <p className="mt-2 text-sm text-foreground/50">
            Saved notes are injected into every curation (style, language, tagging
            habits). Musixmatch official rules still win on conflict.
          </p>
          <textarea
            value={trainingInput}
            onChange={(e) => setTrainingInput(e.target.value)}
            rows={3}
            placeholder="e.g. Always use [Verse 1] not [Verse I]. Keep Roman Urdu lines as-is."
            className="mt-3 w-full rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm"
          />
          <button
            type="button"
            onClick={addTraining}
            className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Add training note
          </button>
          {trainingList.length > 0 && (
            <ul className="mt-4 space-y-2">
              {trainingList.map((note, i) => (
                <li
                  key={`${i}-${note.slice(0, 12)}`}
                  className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-foreground/80">{note}</span>
                  <button
                    type="button"
                    onClick={() => {
                      removeTrainingMessage(i);
                      refresh();
                    }}
                    className="shrink-0 text-xs text-red-300 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {message && (
        <p className="text-sm text-foreground/70" role="status">
          {message}
        </p>
      )}

      <p className="text-center text-sm text-foreground/40">
        <Link href="/" className="text-accent underline">
          Back to player
        </Link>
      </p>
    </main>
  );
}
