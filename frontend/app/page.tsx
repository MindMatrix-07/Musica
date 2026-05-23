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
  type StreamPass,
} from "@/lib/api";
import {
  compressAudioIfNeeded,
  formatBytes,
} from "@/lib/compress-audio";
import { getSplitStructure } from "@/lib/pipeline";
import { getStoredPrompt, setStoredPrompt } from "@/lib/prompt";
import { hasApiKey } from "@/lib/settings";

const TEMPERATURE = 0.1;

export default function DashboardPage() {
  const [model, setModel] = useState<CurateModel>("gemini-3.5-flash");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [splitStructure, setSplitStructure] = useState(true);
  const [streamEvents, setStreamEvents] = useState<CurateStreamEvent[]>([]);
  const [liveText, setLiveText] = useState("");
  const [currentPass, setCurrentPass] = useState<StreamPass | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUserPrompt(getStoredPrompt());
    setSplitStructure(getSplitStructure());
    const syncPipeline = () => setSplitStructure(getSplitStructure());
    window.addEventListener("musica-pipeline-updated", syncPipeline);
    return () =>
      window.removeEventListener("musica-pipeline-updated", syncPipeline);
  }, []);

  useEffect(() => {
    setStoredPrompt(userPrompt);
  }, [userPrompt]);

  useEffect(() => {
    const sync = () => setApiKeyReady(hasApiKey());
    sync();
    window.addEventListener("musica-settings-updated", sync);
    return () => window.removeEventListener("musica-settings-updated", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  const loadFile = useCallback(
    (selected: File) => {
      setFile(selected);
      setFileName(selected.name);
      setError(null);
      setMarkdown(null);
      setStreamEvents([]);
      setLiveText("");
      setCurrentPass(null);

      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      const url = URL.createObjectURL(selected);
      audioUrlRef.current = url;
      setAudioUrl(url);
    },
    []
  );

  const runCuration = useCallback(
    async (targetFile?: File) => {
      const audioFile = targetFile ?? file;
      if (!audioFile || !hasApiKey()) return;

      setProcessing(true);
      setError(null);
      setMarkdown(null);
      setStreamEvents([]);
      setLiveText("");
      setCurrentPass(null);

      try {
        const { file: uploadFile, compressed, originalSize, finalSize } =
          await compressAudioIfNeeded(audioFile);

      if (compressed) {
        setStreamEvents([
          {
            type: "status",
            message: `Compressed ${formatBytes(originalSize)} → ${formatBytes(finalSize)}`,
          },
        ]);
      }

      const result = await curateAudioStream(uploadFile, {
        model,
        temperature: TEMPERATURE,
        userPrompt,
        splitStructure,
        onEvent: (event) => {
          setStreamEvents((prev) => [...prev, event]);
          if (event.type === "pass_start") {
            setCurrentPass(event.pass);
            setLiveText("");
          }
          if (event.type === "chunk") {
            setCurrentPass(event.pass);
            setLiveText((t) => t + event.text);
          }
          if (event.type === "pass_end") {
            setLiveText("");
          }
          if (event.type === "done") {
            setMarkdown(event.markdown);
            setCurrentPass(null);
            setLiveText("");
          }
        },
      });

        setMarkdown(result.markdown);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setProcessing(false);
      }
    },
    [file, model, userPrompt, splitStructure]
  );

  const onFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (!f) return;
      loadFile(f);
      if (hasApiKey()) {
        await runCuration(f);
      }
    },
    [loadFile, runCuration]
  );

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
          Add your Gemini API key in{" "}
          <Link href="/settings" className="font-medium underline">
            Settings
          </Link>{" "}
          to enable curation.
        </div>
      )}

      <div className="space-y-6">
        <MusicPlayerHero
          audioUrl={audioUrl}
          fileName={fileName}
          onUploadClick={() => fileInputRef.current?.click()}
          onCurate={() => runCuration()}
          canCurate={apiKeyReady}
          processing={processing}
          disabled={!apiKeyReady}
        />

        <CurationLiveFeed
          active={processing}
          events={streamEvents}
          liveText={liveText}
          currentPass={currentPass}
        />

        <LyricsPanel markdown={markdown} processing={processing} />

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
              disabled={processing}
            />
            <ConfigPanel
              model={model}
              onModelChange={setModel}
              temperature={TEMPERATURE}
              splitStructure={splitStructure}
              onSplitStructureChange={setSplitStructure}
              disabled={processing}
            />
            {file && !processing && (
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

      <footer className="mt-10 text-center text-xs text-foreground/30">
        Powered by Google AI Studio (Gemini) ·{" "}
        <a
          href="https://community.musixmatch.com/guidelines?lng=en"
          className="underline hover:text-foreground/50"
          target="_blank"
          rel="noreferrer"
        >
          Musixmatch Guidelines
        </a>
      </footer>
    </main>
  );
}
