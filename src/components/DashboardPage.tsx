"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { hasActiveApiKey, getPreferredModel, setPreferredModel } from "@/lib/ai-settings";
import {
  compressAudioIfNeeded,
  formatBytes,
} from "@/lib/compress-audio";
import { getSplitStructure } from "@/lib/pipeline";
import { getStoredPrompt, setStoredPrompt } from "@/lib/prompt";

const TEMPERATURE = 0.1;

interface DashboardPageProps {
  onTabChange: (tab: "player" | "settings") => void;
}

export function DashboardPage({ onTabChange }: DashboardPageProps) {
  const [model, setModel] = useState<CurateModel>(() => getPreferredModel());
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [lyricsPhase, setLyricsPhase] = useState<LyricsPhase>("idle");
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
    const sync = () => {
      setApiKeyReady(hasActiveApiKey());
      setSplitStructure(getSplitStructure());
      setModel(getPreferredModel());
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
    setStreamEvents((prev) => [...prev, event]);

    if (event.type === "pass_start") {
      setCurrentPass(event.pass);
      setLiveText("");
      if (event.pass === "structure") {
        setLyricsPhase("structuring");
      }
    }

    if (event.type === "chunk") {
      setCurrentPass(event.pass);
      if (event.pass === "transcription" || event.pass === "single-pass") {
        setLyricsPhase("transcription");
        setMarkdown((prev) => (prev ?? "") + event.text);
        setLiveText((t) => t + event.text);
      } else if (event.pass === "structure") {
        setLiveText((t) => t + event.text);
      }
    }

    if (event.type === "pass_end") {
      if (event.pass === "transcription" || event.pass === "single-pass") {
        if (event.draft) setMarkdown(event.draft);
        setLyricsPhase(splitStructure ? "structuring" : "done");
      }
      if (event.pass === "structure") {
        setLiveText("");
      }
    }

    if (event.type === "done") {
      setMarkdown(event.markdown);
      setLyricsPhase("done");
      setCurrentPass(null);
      setLiveText("");
    }
  }, [splitStructure]);

  const loadFile = useCallback((selected: File) => {
    setFile(selected);
    setFileName(selected.name);
    setError(null);
    setMarkdown(null);
    setLyricsPhase("idle");
    setStreamEvents([]);
    setLiveText("");
    setCurrentPass(null);

    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    const url = URL.createObjectURL(selected);
    audioUrlRef.current = url;
    setAudioUrl(url);
  }, []);

  const runCuration = useCallback(
    async (targetFile?: File) => {
      const audioFile = targetFile ?? file;
      if (!audioFile) return;

      setProcessing(true);
      setError(null);
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

        setMarkdown(result.markdown);
        setLyricsPhase("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setLyricsPhase("idle");
      } finally {
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
      await runCuration(f);
    },
    [loadFile, runCuration]
  );

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.webm,.ogg,audio/*"
        className="hidden"
        onChange={onFileInput}
      />

      {!apiKeyReady && (
        <div
          className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-200 shadow-md flex items-center justify-between"
          role="alert"
        >
          <span>
            API Key is required to run curation. You can configure your AI provider in Settings.
          </span>
          <button
            type="button"
            onClick={() => onTabChange("settings")}
            className="font-medium underline cursor-pointer ml-3 bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition"
          >
            Settings
          </button>
        </div>
      )}

      <div className="space-y-6">
        <MusicPlayerHero
          audioUrl={audioUrl}
          fileName={fileName}
          onUploadClick={() => fileInputRef.current?.click()}
          onCurate={() => runCuration()}
          canCurate={true}
          processing={processing}
          disabled={false}
        />

        <CurationLiveFeed
          active={processing}
          events={streamEvents}
          liveText={liveText}
          currentPass={currentPass}
        />

        <LyricsPanel
          markdown={markdown}
          processing={processing}
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
              disabled={processing}
            />
            <ConfigPanel
              model={model}
              onModelChange={(newModel) => {
                setModel(newModel);
                setPreferredModel(newModel);
              }}
              temperature={TEMPERATURE}
              splitStructure={splitStructure}
              onSplitStructureChange={setSplitStructure}
              disabled={processing}
            />
            {file && !processing && (
              <button
                type="button"
                onClick={() => runCuration()}
                className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-foreground transition hover:border-[#c084fc]/60 hover:bg-[#c084fc]/10"
              >
                Re-run curation
              </button>
            )}
          </div>
        </details>
      </div>

      {error && (
        <div
          className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}
