const STRUCTURE_TAG_PATTERN =
  /^\[(?:Intro|Outro|Verse(?:\s+\d+)?|Pre-Chorus|Chorus|Post-Chorus|Bridge|Hook|Refrain|Interlude|Instrumental|Solo|Spoken|Ad-lib|Adlib|Break|Drop|Build|Part(?:\s+\d+)?)\]$/i;

export function isStructureTagLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return false;
  return STRUCTURE_TAG_PATTERN.test(trimmed);
}
