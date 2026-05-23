const STRUCTURE_TAG =
  /^\s*\[(Intro|Verse\s*\d*|Pre-Chorus|Chorus|Bridge|Outro|Hook|Instrumental)[^\]]*\]\s*$/i;

export function isStructureTagLine(line: string): boolean {
  return STRUCTURE_TAG.test(line.trim());
}

export function enhanceMarkdownForDisplay(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (isStructureTagLine(trimmed)) {
        const inner = trimmed.slice(1, -1);
        return `<span class="tag-badge">[${inner}]</span>`;
      }
      return line;
    })
    .join("\n");
}
