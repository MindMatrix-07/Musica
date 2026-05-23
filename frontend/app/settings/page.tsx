"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  clearApiKey,
  getApiKey,
  maskApiKey,
  setApiKey,
} from "@/lib/settings";

export default function SettingsPage() {
  const [input, setInput] = useState("");
  const [savedMasked, setSavedMasked] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const existing = getApiKey();
    if (existing) {
      setSavedMasked(maskApiKey(existing));
    }
  }, []);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setMessage("Enter a valid API key before saving.");
      return;
    }
    setApiKey(trimmed);
    setSavedMasked(maskApiKey(trimmed));
    setInput("");
    setMessage("API key saved in this browser.");
  };

  const handleClear = () => {
    clearApiKey();
    setSavedMasked(null);
    setInput("");
    setMessage("API key removed from this browser.");
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <AppHeader />

      <div className="glass-panel p-6">
        <h2 className="text-lg font-medium text-foreground">Gemini API Key</h2>
        <p className="mt-2 text-sm text-foreground/50">
          Your key is stored only in this browser&apos;s local storage and sent
          with each curation request. It is never written to the server
          environment. Get a free key from{" "}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noreferrer"
            className="text-accent underline hover:text-accent/80"
          >
            Google AI Studio
          </a>
          .
        </p>

        {savedMasked && (
          <p className="mt-4 rounded-lg border border-surface-border bg-surface/50 px-3 py-2 font-mono text-xs text-foreground/70">
            Saved: {savedMasked}
          </p>
        )}

        <label className="mt-6 block">
          <span className="text-xs font-medium uppercase tracking-widest text-foreground/50">
            {savedMasked ? "Replace API key" : "API key"}
          </span>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste your GEMINI_API_KEY"
            autoComplete="off"
            spellCheck={false}
            className="mt-2 w-full rounded-xl border border-surface-border bg-surface px-4 py-3 font-mono text-sm text-foreground placeholder:text-foreground/30 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </label>

        {message && (
          <p
            className="mt-4 text-sm text-foreground/70"
            role="status"
          >
            {message}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-muted"
          >
            Save key
          </button>
          {savedMasked && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-xl border border-surface-border px-5 py-2.5 text-sm font-medium text-foreground/80 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
            >
              Remove key
            </button>
          )}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-foreground/40">
        <Link href="/" className="text-accent underline hover:text-accent/80">
          Back to Curate
        </Link>
      </p>
    </main>
  );
}
