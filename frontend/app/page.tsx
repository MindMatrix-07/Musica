"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfigPanel } from "@/components/ConfigPanel";
import { CurationLiveFeed } from "@/components/CurationLiveFeed";
import { LyricsPanel } from "@/components/LyricsPanel";
import { MusicPlayerHero } from "@/components/MusicPlayerHero";
import { PromptBox } from "@/components/PromptBox";
import {
  curateAudioStream,
  type CurateModel,
  type CurateStreamEvent,
  type LyricsPhase,
  type StreamPass,
} from "@/lib/api";
import { hasActiveApiKey } from "@/lib/ai-settings";
import {
  compressAudioIfNeeded,
  formatBytes,
} from "@/lib/compress-audio";
import { getSplitStructure } from "@/lib/pipeline";
import { getStoredPrompt, setStoredPrompt } from "@/lib/prompt";
import { createUiBatcher } from "@/lib/ui-batch";

const TEMPERATURE = 0.1;

function isFeedEvent(event: CurateStreamEvent): boolean {
  return event.type !== "chunk";
}

export default function DashboardPage() {
  const [model, setModel] = useState<CurateModel>("gemini-3.5-flash");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [lyricsPhase, setLyricsPhase] = useState<LyricsPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [splitStructure, setSplitStructure] = useState(true);
  const [streamEvents, setStreamEvents] = useState<CurateStreamEvent[]>([]);
  const [liveText, setLiveText] = useState("");
  const [currentPass, setCurrentPass] = useState<StreamPass | null>(null);

  const audioUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markdownBufRef = useRef("");
  const liveTextBufRef = useRef("");
  const splitStructureRef = useRef(splitStructure);

  const uiBatcherRef = useRef(
    createUiBatcher(() => {
      setMarkdown(markdownBufRef.current);
      setLiveText(liveTextBufRef.current);
    }, 180)
  );

  useEffect(() => {
    splitStructureRef.current = splitStructure;
  }, [splitStructure]);

  useEffect(() => {
    setUserPrompt(getStoredPrompt());
    setSplitStructure(getSplitStructure());
    const sync = () => {
      setApiKeyReady(hasActiveApiKey());
      setSplitStructure(getSplitStructure());
    };
    sync();
    window.addEventListener("musica-settings-updated", sync);
    window.addEventListener("musica-pipeline-updated", sync);
    return () => {
      window.removeEventListener("musica-settings-updated", sync);
      window.removeEventListener("musica-pipeline-updated", sync);
    };
  }, []);

  useEffect(() => {
    setStoredPrompt(userPrompt);
  }, [userPrompt]);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const handleStreamEvent = useCallback((event: CurateStreamEvent) => {
    if (isFeedEvent(event)) {
      setStreamEvents((prev) => [...prev, event]);
    }

    if (event.type === "pass_start") {
      setCurrentPass(event.pass);
      liveTextBufRef.current = "";
      setLiveText("");
      if (event.pass === "structure") {
        setLyricsPhase("structuring");
      }
    }

    if (event.type === "chunk") {
      setCurrentPass(event.pass);
      if (event.pass === "transcription" || event.pass === "single-pass") {
        setLyricsPhase("transcription");
        markdownBufRef.current += event.text;
        liveTextBufRef.current += event.text;
        uiBatcherRef.current.schedule();
      } else if (event.pass === "structure") {
        liveTextBufRef.current += event.text;
        uiBatcherRef.current.schedule();
      }
    }

    if (event.type === "pass_end") {
      uiBatcherRef.current.flushNow();
      if (event.pass === "transcription" || event.pass === "single-pass") {
        if (event.draft) {
          markdownBufRef.current = event.draft;
          setMarkdown(event.draft);
        }
        setLyricsPhase(
          splitStructureRef.current ? "structuring" : "done"
        );
      }
      if (event.pass === "structure") {
        liveTextBufRef.current = "";
        setLiveText("");
      }
    }

    if (event.type === "done") {
      uiBatcherRef.current.flushNow();
      markdownBufRef.current = event.markdown;
      setMarkdown(event.markdown);
      setLyricsPhase("done");
      setCurrentPass(null);
      liveTextBufRef.current = "";
      setLiveText("");
    }
  }, []);

  const loadFile = useCallback((selected: File) => {
    setFile(selected);
    setFileName(selected.name);
    setError(null);
    setMarkdown(null);
    setLyricsPhase("idle");
    setStreamEvents([]);
    setLiveText("");
    setCurrentPass(null);
    markdownBufRef.current = "";
    liveTextBufRef.current = "";

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(selected);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const runCuration = useCallback(
    async (targetFile?: File) => {
      const audioFile = targetFile ?? file;
      if (!audioFile || !hasActiveApiKey()) return;

      setProcessing(true);
      setPreparing(true);
      setError(null);
      markdownBufRef.current = "";
      liveTextBufRef.current = "";
      setMarkdown("");
      setLyricsPhase("transcription");
      setStreamEvents([]);
      setLiveText("");
      setCurrentPass(null);

      try {
        const {
          file: uploadFile,
          compressed,
          originalSize,
          finalSize,
          qualityLabel,
        } = await compressAudioIfNeeded(audioFile);

        setPreparing(false);

        if (compressed) {
          setStreamEvents([
            {
              type: "status",
              message: `Compressed ${formatBytes(originalSize)} → ${formatBytes(finalSize)}${
                qualityLabel ? ` · ${qualityLabel}` : ""
              }`,
            },
          ]);
        }

        const result = await curateAudioStream(uploadFile, {
          model,
          temperature: TEMPERATURE,
          userPrompt,
          splitStructure,
          onEvent: handleStreamEvent,
        });

        uiBatcherRef.current.flushNow();
        markdownBufRef.current = result.markdown;
        setMarkdown(result.markdown);
        setLyricsPhase("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLyricsPhase("idle");
      } finally {
        setPreparing(false);
        setProcessing(false);
      }
    },
    [file, model, userPrompt, splitStructure, handleStreamEvent]
  );

  const onFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      loadFile(f);
      if (hasActiveApiKey()) {
        await runCuration(f);
      }
    },
    [loadFile, runCuration]
  );

  const busy = processing || preparing;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <AppHeader />

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.webm,.ogg,audio/*"
        className="hidden"
        onChange={onFileInput}
      />

      {!apiKeyReady && (
        <div
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          Configure your AI provider in{" "}
          <Link href="/settings" className="font-medium underline">
            Settings
          </Link>
          .
        </div>
      )}

      <div className="space-y-6">
        <MusicPlayerHero
          audioUrl={audioUrl}
          fileName={fileName}
          onUploadClick={() => fileInputRef.current?.click()}
          onCurate={() => runCuration()}
          canCurate={apiKeyReady}
          processing={busy}
          preparing={preparing}
          disabled={!apiKeyReady}
        />

        <CurationLiveFeed
          active={busy}
          events={streamEvents}
          liveText={liveText}
          currentPass={currentPass}
        />

        <LyricsPanel
          markdown={markdown}
          processing={busy}
          phase={lyricsPhase}
        />

        <details className="glass-panel group open:pb-5">
          <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-foreground/80 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between">
              Options & instructions
              <span className="text-foreground/40 transition group-open:rotate-180">
                ▾
              </span>
            </span>
          </summary>
          <div className="space-y-4 border-t border-white/10 px-5 pt-4">
            <PromptBox
              value={userPrompt}
              onChange={setUserPrompt}
              disabled={busy}
            />
            <ConfigPanel
              model={model}
              onModelChange={setModel}
              temperature={TEMPERATURE}
              splitStructure={splitStructure}
              onSplitStructureChange={setSplitStructure}
              disabled={busy}
            />
            {file && !busy && (
              <button
                type="button"
                onClick={() => runCuration()}
                disabled={!apiKeyReady}
                className="w-full rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/60 hover:bg-accent/10 disabled:opacity-40"
              >
                Re-run curation
              </button>
            )}
          </div>
        </details>
      </div>

      {error && (
        <div
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}
    </main>
  );
}
