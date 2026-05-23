"use client";

import { useEffect, useState } from "react";
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
  getPreferredModel,
  setPreferredModel,
  type AiProvider,
  type CurateModel,
} from "@/lib/ai-settings";

interface SettingsPageProps {
  onTabChange: (tab: "player" | "settings") => void;
}

export function SettingsPage({ onTabChange }: SettingsPageProps) {
  const [provider, setProviderState] = useState<AiProvider>("gemini");
  const [preferredModel, setPreferredModelState] = useState<CurateModel>("gemini-3.5-flash");
  const [geminiInput, setGeminiInput] = useState("");
  const [openaiInput, setOpenaiInput] = useState("");
  const [geminiMasked, setGeminiMasked] = useState<string | null>(null);
  const [openaiMasked, setOpenaiMasked] = useState<string | null>(null);
  const [trainingInput, setTrainingInput] = useState("");
  const [trainingList, setTrainingList] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = () => {
    setProviderState(getProvider());
    setPreferredModelState(getPreferredModel());
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
    <div className="w-full max-w-2xl mx-auto space-y-6">
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
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${
                provider === p
                  ? "border-[#c084fc] bg-[#c084fc]/20 text-foreground"
                  : "border-white/10 text-foreground/60 hover:border-white/20"
              }`}
            >
              {p === "gemini" ? "Google Gemini" : "OpenAI"}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-medium text-[#f8f4ff]">Gemini API key</h2>
        <p className="mt-2 text-sm text-foreground/50">
          Get a free key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-[#c084fc] underline"
          >
            Google AI Studio
          </a>.
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
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#c084fc]/50"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={saveGemini}
            className="rounded-xl bg-[#c084fc] hover:bg-[#a855f7] px-4 py-2 text-sm font-medium text-white cursor-pointer transition"
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
              className="rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2 text-sm cursor-pointer transition"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="glass-panel p-6">
        <h2 className="text-lg font-medium text-foreground">Preferred Gemini Model</h2>
        <p className="mt-2 text-sm text-foreground/50">
          Choose which Gemini model handles the core lyrics transcription pass. Gemini 3.5 Flash is recommended for its speed and balanced accuracy.
        </p>
        <div className="mt-4 flex gap-3">
          {(["gemini-3.5-flash", "gemini-3.5-pro"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPreferredModel(m);
                setPreferredModelState(m);
                setMessage(`Preferred model set to ${m === "gemini-3.5-flash" ? "Gemini 3.5 Flash" : "Gemini 3.5 Pro"}.`);
              }}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm font-medium transition cursor-pointer ${
                preferredModel === m
                  ? "border-[#c084fc] bg-[#c084fc]/20 text-foreground"
                  : "border-white/10 text-foreground/60 hover:border-white/20"
              }`}
            >
              {m === "gemini-3.5-flash" ? "Gemini 3.5 Flash (Fast)" : "Gemini 3.5 Pro (Precise)"}
            </button>
          ))}
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
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#c084fc]/50"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={saveOpenai}
            className="rounded-xl bg-[#c084fc] hover:bg-[#a855f7] px-4 py-2 text-sm font-medium text-white cursor-pointer transition"
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
              className="rounded-xl border border-white/10 hover:bg-white/5 px-4 py-2 text-sm cursor-pointer transition"
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
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm focus:outline-none focus:border-[#c084fc]/50"
        />
        <button
          type="button"
          onClick={addTraining}
          className="mt-3 rounded-xl bg-[#c084fc] hover:bg-[#a855f7] px-4 py-2 text-sm font-medium text-white cursor-pointer transition"
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
                  className="shrink-0 text-xs text-red-300 hover:underline cursor-pointer"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <p className="text-sm text-[#f8f4ff]/75 bg-white/5 py-2 px-3 rounded-lg text-center" role="status">
          {message}
        </p>
      )}

      <div className="pt-4 text-center">
        <button
          type="button"
          onClick={() => onTabChange("player")}
          className="text-[#c084fc] hover:text-[#a855f7] underline cursor-pointer text-sm font-medium"
        >
          Back to player
        </button>
      </div>
    </div>
  );
}
