"use client";

import type { CurateStreamEvent, StreamPass } from "@/lib/api";

interface CurationLiveFeedProps {
  active: boolean;
  events: CurateStreamEvent[];
  liveText: string;
  currentPass: StreamPass | null;
}

export function CurationLiveFeed({
  active,
  events,
  liveText,
  currentPass,
}: CurationLiveFeedProps) {
  const statuses = events.filter((e) => e.type === "status");
  const passes = events.filter(
    (e) => e.type === "pass_start" || e.type === "pass_end"
  );

  if (!active && events.length === 0) {
    return (
      <div className="glass-panel p-5 text-sm text-foreground/45">
        <p className="font-medium text-foreground/70">Google AI Studio live feed</p>
        <p className="mt-1">
          Status and streamed tokens appear here while Gemini curates your track.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-panel flex max-h-[320px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          {active && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-500" />
            </span>
          )}
          <h3 className="text-xs font-medium uppercase tracking-widest text-foreground/60">
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noreferrer"
              className="hover:text-fuchsia-200"
            >
              Google AI Studio
            </a>
          </h3>
        </div>
        {currentPass && (
          <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs text-fuchsia-200">
            {currentPass}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4 font-mono text-xs">
        {statuses.map((e, i) =>
          e.type === "status" ? (
            <p key={`s-${i}`} className="text-violet-200/80">
              ▸ {e.message}
            </p>
          ) : null
        )}
        {passes.map((e, i) =>
          e.type === "pass_start" ? (
            <p key={`p-${i}`} className="font-sans text-sm text-fuchsia-200">
              {e.message}
            </p>
          ) : e.type === "pass_end" ? (
            <p key={`pe-${i}`} className="text-emerald-300/80">
              ✓ {e.pass} complete
            </p>
          ) : null
        )}
        {liveText && (
          <pre className="whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-black/25 p-3 text-foreground/75">
            {liveText}
            {active && (
              <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-fuchsia-400" />
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
