"use client";

import { useCallback, useRef, useState } from "react";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = ["audio/mpeg", "audio/wav", "audio/x-wav", ".mp3", ".wav"];

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  progress?: number | null;
}

export function UploadZone({
  onFileSelect,
  disabled,
  progress,
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const validate = useCallback((file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".mp3") && !ext.endsWith(".wav")) {
      return "Only MP3 and WAV files are supported.";
    }
    if (file.size > MAX_BYTES) {
      return "File must be 50 MB or smaller.";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      const msg = validate(file);
      if (msg) {
        setError(msg);
        return;
      }
      setError(null);
      setFileName(file.name);
      onFileSelect(file);
    },
    [onFileSelect, validate]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [disabled, handleFile]
  );

  const busy = progress !== null && progress !== undefined && progress < 100;

  return (
    <div className="glass-panel p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-foreground/50">
        Audio Upload
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          dragOver
            ? "border-accent bg-accent/10"
            : "border-surface-border hover:border-accent/50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <p className="text-lg font-medium text-foreground">
          Drop your track here
        </p>
        <p className="mt-2 text-sm text-foreground/45">
          MP3 or WAV · auto-compress if over ~3.5 MB
        </p>
        {fileName && (
          <p className="mt-4 font-mono text-xs text-accent">{fileName}</p>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {busy && (
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-foreground/50">
            <span>Curating lyrics…</span>
            <span>{Math.round(progress ?? 0)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-border">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progress ?? 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
