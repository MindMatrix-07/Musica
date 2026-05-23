"use client";

const MAX_CHARS = 2000;

interface PromptBoxProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function PromptBox({ value, onChange, disabled }: PromptBoxProps) {
  return (
    <div className="glass-panel p-5">
      <h2 className="mb-1 text-sm font-medium uppercase tracking-widest text-foreground/50">
        AI instructions
      </h2>
      <p className="mb-3 text-xs text-foreground/45">
        Optional notes sent with your audio (language, structure hints, ad-libs,
        etc.). Musixmatch rules still apply.
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
        disabled={disabled}
        rows={5}
        placeholder="e.g. Song is bilingual — keep Spanish lines as-is. Label the spoken intro as [Intro]. Include all backing vocal repeats."
        className="w-full resize-y rounded-xl border border-surface-border bg-surface px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-foreground/30 focus:border-accent/60 focus:outline-none focus:ring-1 focus:ring-accent/40 disabled:opacity-50"
      />
      <p className="mt-2 text-right text-xs text-foreground/35">
        {value.length}/{MAX_CHARS}
      </p>
    </div>
  );
}
