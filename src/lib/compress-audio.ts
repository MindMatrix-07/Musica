const MAX_DIRECT_UPLOAD_BYTES = 3.8 * 1024 * 1024;

export interface CompressionResult {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
  qualityLabel?: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export async function compressAudioIfNeeded(file: File): Promise<CompressionResult> {
  return {
    file,
    compressed: false,
    originalSize: file.size,
    finalSize: file.size,
    qualityLabel:
      file.size > MAX_DIRECT_UPLOAD_BYTES
        ? "Large upload: use a shorter clip if your host rejects it"
        : undefined,
  };
}
