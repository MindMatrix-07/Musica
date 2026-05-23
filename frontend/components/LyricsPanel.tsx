"use client";

import { useState } from "react";
import { LyricsMarkdown } from "./LyricsMarkdown";

interface LyricsPanelProps {
  markdown: string | null;
  processing: boolean;
}

export function LyricsPanel({ markdown, processing }: LyricsPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyLyrics = async () => {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="glass-panel flex min-h-[400px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <h3 className="text-xs font-medium uppercase tracking-widest text-foreground/50">
          Curated lyrics
        </h3>
        <button
          type="button"
          onClick={copyLyrics}
          disabled={!markdown}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-fuchsia-400/40 hover:bg-fuchsia-500/15 disabled:opacity-30"
        >
          {copied ? "Copied!" : "Copy lyrics"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {markdown ? (
          <LyricsMarkdown markdown={markdown} />
        ) : processing ? (
          <p className="text-sm text-foreground/45">
            Lyrics will appear here as Gemini streams…
          </p>
        ) : (
          <p className="text-sm text-foreground/40">
            Upload a track and run curation to generate lyrics.
          </p>
        )}
      </div>
    </div>
  );
}
