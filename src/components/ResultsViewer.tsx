"use client";

import { LyricsMarkdown } from "./LyricsMarkdown";

interface ResultsViewerProps {
  audioUrl: string | null;
  markdown: string | null;
}

export function ResultsViewer({ audioUrl, markdown }: ResultsViewerProps) {
  if (!audioUrl && !markdown) {
    return (
      <div className="glass-panel flex min-h-[420px] items-center justify-center p-8 text-center text-foreground/40">
        <p>Upload a track and run curation to see results here.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel grid min-h-[520px] grid-cols-1 gap-0 overflow-hidden lg:grid-cols-2">
      <div className="border-b border-surface-border p-6 lg:border-b-0 lg:border-r">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-foreground/50">
          Playback
        </h3>
        {audioUrl ? (
          <audio
            controls
            src={audioUrl}
            className="w-full"
            preload="metadata"
          />
        ) : (
          <p className="text-sm text-foreground/40">No audio loaded</p>
        )}
        <p className="mt-4 text-xs text-foreground/35">
          Use playback to verify structure tags and line accuracy while
          reviewing curated output.
        </p>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-6 lg:max-h-none">
        <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-foreground/50">
          Curated Lyrics
        </h3>
        {markdown ? (
          <LyricsMarkdown markdown={markdown} />
        ) : (
          <p className="text-sm text-foreground/40">Waiting for output…</p>
        )}
      </div>
    </div>
  );
}
