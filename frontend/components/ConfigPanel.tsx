"use client";

import type { CurateModel } from "@/lib/api";

interface ConfigPanelProps {
  model: CurateModel;
  onModelChange: (model: CurateModel) => void;
  temperature: number;
  disabled?: boolean;
}

export function ConfigPanel({
  model,
  onModelChange,
  temperature,
  disabled,
}: ConfigPanelProps) {
  const isFast = model === "gemini-3.5-flash";

  return (
    <div className="glass-panel p-5">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-foreground/50">
        Configuration
      </h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Model</p>
          <p className="mt-0.5 text-xs text-foreground/45">
            {isFast ? "Fast processing" : "Maximum reasoning depth"}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={!isFast}
          disabled={disabled}
          onClick={() =>
            onModelChange(
              isFast ? "gemini-1.5-pro" : "gemini-3.5-flash"
            )
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
        <span className={!isFast ? "text-accent" : ""}>gemini-1.5-pro</span>
      </div>

      <div className="mt-5 border-t border-surface-border pt-4">
        <div className="flex justify-between text-xs">
          <span className="text-foreground/50">Temperature</span>
          <span className="font-mono text-foreground/70">{temperature}</span>
        </div>
        <p className="mt-1 text-xs text-foreground/40">
          Fixed at 0.1 for analytical accuracy
        </p>
      </div>
    </div>
  );
}
