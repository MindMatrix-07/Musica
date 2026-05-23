"use client";

import { memo } from "react";
import { isStructureTagLine } from "@/lib/lyrics";

interface LyricsMarkdownProps {
  markdown: string;
}

function LineWithBadge({ line }: { line: string }) {
  const trimmed = line.trim();
  if (isStructureTagLine(trimmed)) {
    const label = trimmed.slice(1, -1);
    return (
      <div className="my-3">
        <span className="tag-badge">[{label}]</span>
      </div>
    );
  }
  return <p className="my-0.5 leading-relaxed text-foreground/85">{line || "\u00A0"}</p>;
}

export const LyricsMarkdown = memo(function LyricsMarkdown({
  markdown,
}: LyricsMarkdownProps) {
  const lines = markdown.split("\n");

  return (
    <div className="lyrics-markdown space-y-0 font-sans text-[15px]">
      {lines.map((line, i) => (
        <LineWithBadge key={`${i}-${line.slice(0, 20)}`} line={line} />
      ))}
    </div>
  );
});
