"use client";

import { useState } from "react";
import type { LyricsPhase } from "@/lib/api";
import { LyricsMarkdown } from "./LyricsMarkdown";

interface LyricsPanelProps {
  markdown: string | null;
  processing: boolean;
  phase: LyricsPhase;
}

const PHASE_LABEL: Record<LyricsPhase, string> = {
  idle: "",
  transcription: "Live transcription",
  structuring: "Applying structure tags…",
  done: "Complete",
};

export function LyricsPanel({ markdown, processing, phase }: LyricsPanelProps) {
  const [copied, setCopied] = useState(false);
  const showFormatted = phase === "done" && Boolean(markdown);

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
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium uppercase tracking-widest text-foreground/50">
            Curated lyrics
          </h3>
          {phase !== "idle" && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                phase === "structuring"
                  ? "bg-amber-500/20 text-amber-200"
                  : phase === "transcription"
                    ? "bg-fuchsia-500/20 text-fuchsia-200"
                    : "bg-emerald-500/20 text-emerald-200"
              }`}
            >
              {PHASE_LABEL[phase]}
            </span>
          )}
        </div>
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
          showFormatted ? (
            <LyricsMarkdown markdown={markdown} />
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-[15px] leading-relaxed text-foreground/85">
              {markdown}
            </pre>
          )
        ) : processing ? (
          <p className="text-sm text-foreground/45">
            Waiting for transcription…
          </p>
        ) : (
          <p className="text-sm text-foreground/40">
            Upload a track — lyrics appear here as soon as pass 1 streams.
          </p>
        )}
      </div>
    </div>
  );
}
