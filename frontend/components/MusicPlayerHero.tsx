"use client";

import { useRef, useState } from "react";

interface MusicPlayerHeroProps {
  audioUrl: string | null;
  fileName: string | null;
  onUploadClick: () => void;
  onCurate: () => void;
  canCurate: boolean;
  processing: boolean;
  preparing?: boolean;
  disabled?: boolean;
}

export function MusicPlayerHero({
  audioUrl,
  fileName,
  onUploadClick,
  onCurate,
  canCurate,
  processing,
  preparing,
  disabled,
}: MusicPlayerHeroProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <section className="glass-panel overflow-hidden p-0">
      <div className="relative bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-orange-500/20 px-6 py-10 sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center gap-1 pb-8 opacity-40">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className={`w-1 rounded-full bg-fuchsia-200/80 ${
                playing ? "animate-pulse" : ""
              }`}
              style={{
                height: `${12 + (i % 5) * 8}px`,
                animationDelay: playing ? `${i * 0.05}s` : undefined,
              }}
            />
          ))}
        </div>

        <div className="relative z-10">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-fuchsia-200/80">
            Now playing
          </p>
          <h2 className="mt-2 truncate text-2xl font-semibold text-white sm:text-3xl">
            {fileName ?? "Drop a track to begin"}
          </h2>

          {audioUrl ? (
            <div className="mt-6 space-y-4">
              <audio
                ref={audioRef}
                src={audioUrl}
                className="w-full"
                controls
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
              />
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={disabled || processing}
                  onClick={onCurate}
                  className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-violet-950 transition hover:bg-fuchsia-100 disabled:opacity-40"
                >
                  {preparing
                    ? "Compressing…"
                    : processing
                      ? "Curating…"
                      : "Curate lyrics"}
                </button>
                <button
                  type="button"
                  disabled={disabled || processing}
                  onClick={onUploadClick}
                  className="rounded-xl border border-white/25 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
                >
                  Change track
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={onUploadClick}
              className="mt-6 rounded-xl border-2 border-dashed border-white/30 bg-white/5 px-8 py-4 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/10 disabled:opacity-40"
            >
              Upload MP3 or WAV
            </button>
          )}

          {audioUrl && !canCurate && (
            <p className="mt-3 text-xs text-amber-200/90">
              Add your API key in Settings before curating.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
