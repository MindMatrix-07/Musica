"use client";

import type { CurateModel } from "@/lib/api";
import { setSplitStructure } from "@/lib/pipeline";

interface ConfigPanelProps {
  model: CurateModel;
  onModelChange: (model: CurateModel) => void;
  temperature: number;
  splitStructure: boolean;
  onSplitStructureChange: (value: boolean) => void;
  disabled?: boolean;
}

export function ConfigPanel({
  model,
  onModelChange,
  temperature,
  splitStructure,
  onSplitStructureChange,
  disabled,
}: ConfigPanelProps) {
  const isFast = model === "gemini-3.5-flash";

  return (
    <div className="glass-panel p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-foreground/50">
        Models
      </h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Lyrics pass</p>
          <p className="mt-0.5 text-xs text-foreground/45">
            {isFast ? "Gemini 3.5 Flash" : "Gemini 3.5 Pro (latest)"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!isFast}
          disabled={disabled}
          onClick={() =>
            onModelChange(isFast ? "gemini-3.5-pro" : "gemini-3.5-flash")
          }
          className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
            disabled ? "opacity-40" : ""
          } ${isFast ? "bg-surface-border" : "bg-accent"}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              isFast ? "left-1" : "left-7"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 flex justify-between text-xs text-foreground/50">
        <span className={isFast ? "text-accent" : ""}>gemini-3.5-flash</span>
        <span className={!isFast ? "text-accent" : ""}>gemini-3.5-pro</span>
      </div>
      <p className="mt-2 text-xs text-foreground/40">
        Structure pass always uses gemini-3.5-pro (latest Pro).
      </p>

      <div className="mt-5 border-t border-surface-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">
              Split structure tagging
            </p>
            <p className="mt-0.5 text-xs text-foreground/45">
              Show lyrics after pass 1 · tags auto-apply after pass 2
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={splitStructure}
            disabled={disabled}
            onClick={() => {
              const next = !splitStructure;
              setSplitStructure(next);
              onSplitStructureChange(next);
            }}
            className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
              disabled ? "opacity-40" : ""
            } ${splitStructure ? "bg-accent" : "bg-surface-border"}`}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                splitStructure ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-5 border-t border-surface-border pt-4">
        <div className="flex justify-between text-xs">
          <span className="text-foreground/50">Temperature</span>
          <span className="font-mono text-foreground/70">{temperature}</span>
        </div>
      </div>
    </div>
  );
}
