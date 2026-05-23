"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ConfigPanel } from "@/components/ConfigPanel";
import { PromptBox } from "@/components/PromptBox";
import { ResultsViewer } from "@/components/ResultsViewer";
import { UploadZone } from "@/components/UploadZone";
import { curateAudio, type CurateModel, type CurateResponse } from "@/lib/api";
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const [splitStructure, setSplitStructure] = useState(true);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [lastMeta, setLastMeta] = useState<Pick<
    CurateResponse,
    "pipeline" | "compressed"
  > | null>(null);
  const audioUrlRef = useRef<string | null>(null);

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

  const onFileSelect = useCallback(
    async (selected: File) => {
      setFile(selected);
      setError(null);
      setMarkdown(null);

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      const url = URL.createObjectURL(selected);
      audioUrlRef.current = url;
      setAudioUrl(url);

      setProcessing(true);
      setProgress(2);
      setStatusNote(null);
      setLastMeta(null);

      try {
        setProgress(8);
        setStatusNote("Checking audio size…");
        const { file: uploadFile, compressed, originalSize, finalSize } =
          await compressAudioIfNeeded(selected);
        if (compressed) {
          setStatusNote(
            `Compressed ${formatBytes(originalSize)} → ${formatBytes(finalSize)} for upload`
          );
        }

        setProgress(15);
        const result = await curateAudio(uploadFile, {
          model,
          temperature: TEMPERATURE,
          userPrompt,
          splitStructure,
          onProgress: (p) => setProgress(Math.max(15, p)),
        });
        setMarkdown(result.markdown);
        setLastMeta({
          pipeline: result.pipeline,
          compressed: result.compressed || compressed,
        });
        if (result.pipeline?.length) {
          setStatusNote(`Pipeline: ${result.pipeline.join(" → ")}`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setProcessing(false);
        setProgress(null);
      }
    },
    [model, userPrompt, splitStructure]
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <AppHeader />

      <p className="-mt-4 mb-8 max-w-2xl text-sm text-foreground/50">
        Two-pass curation: Gemini writes lyrics, then a structure-only pass
        tags [Verse]/[Chorus] using web + extended Musixmatch guidelines
        together. Large files are compressed in-browser before upload.
      </p>

      {!apiKeyReady && (
        <div
          className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          Add your Gemini API key in{" "}
          <Link href="/settings" className="font-medium underline">
            Settings
          </Link>{" "}
          before uploading audio.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <PromptBox
            value={userPrompt}
            onChange={setUserPrompt}
            disabled={processing}
          />
          <UploadZone
            onFileSelect={onFileSelect}
            disabled={processing || !apiKeyReady}
            progress={processing ? progress : null}
          />
          <ConfigPanel
            model={model}
            onModelChange={setModel}
            temperature={TEMPERATURE}
            splitStructure={splitStructure}
            onSplitStructureChange={setSplitStructure}
            disabled={processing}
          />
          {statusNote && (
            <p className="text-xs text-foreground/45">{statusNote}</p>
          )}
          {file && !processing && (
            <button
              type="button"
              onClick={() => onFileSelect(file)}
              className="w-full rounded-xl border border-surface-border bg-surface-raised px-4 py-3 text-sm font-medium text-foreground transition hover:border-accent/60 hover:bg-accent/10"
            >
              Re-run curation with current settings
            </button>
          )}
        </div>

        <div className="lg:col-span-2">
          {error && (
            <div
              className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              role="alert"
            >
              {error}
            </div>
          )}
          <ResultsViewer audioUrl={audioUrl} markdown={markdown} />
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-foreground/30">
        Grounded on{" "}
        <a
          href="https://community.musixmatch.com/guidelines?lng=en"
          className="underline hover:text-foreground/50"
          target="_blank"
          rel="noreferrer"
        >
          Musixmatch Guidelines
        </a>
        {" · "}
        API key configured in Settings (browser local storage)
      </footer>
    </main>
  );
}
