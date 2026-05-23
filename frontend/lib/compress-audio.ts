/** Target size before upload (aligns with Vercel ~4.5 MB body limit). */
export const COMPRESS_THRESHOLD_BYTES = 3.5 * 1024 * 1024;

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function mixToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const mono = new Float32Array(length);
  const ch0 = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) mono[i] = ch0[i];
  if (buffer.numberOfChannels > 1) {
    const ch1 = buffer.getChannelData(1);
    for (let i = 0; i < length; i++) mono[i] = (mono[i] + ch1[i]) * 0.5;
  }
  return mono;
}

async function decodeToMono(
  file: File,
  sampleRate: number
): Promise<Int16Array> {
  const ctx = new AudioContext({ sampleRate });
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const mono = mixToMono(decoded);
    return floatTo16BitPCM(mono);
  } finally {
    await ctx.close();
  }
}

async function encodeMp3(
  samples: Int16Array,
  sampleRate: number,
  kbps: number
): Promise<Blob> {
  const { Mp3Encoder } = await import("lamejs");
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const block = 1152;
  const chunks: Int8Array[] = [];

  for (let i = 0; i < samples.length; i += block) {
    const slice = samples.subarray(i, i + block);
    const buf = encoder.encodeBuffer(slice);
    if (buf.length > 0) chunks.push(buf);
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(end);

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength), offset);
    offset += chunk.length;
  }
  return new Blob([merged], { type: "audio/mpeg" });
}

export type CompressResult = {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
};

/**
 * Re-encode large MP3/WAV to mono 22.05 kHz MP3 at reduced bitrate for upload.
 */
export async function compressAudioIfNeeded(file: File): Promise<CompressResult> {
  const originalSize = file.size;
  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    return { file, compressed: false, originalSize, finalSize: file.size };
  }

  const sampleRate = 22050;
  let samples = await decodeToMono(file, sampleRate);
  let kbps = 96;
  let blob = await encodeMp3(samples, sampleRate, kbps);

  while (blob.size > COMPRESS_THRESHOLD_BYTES && kbps > 32) {
    kbps -= 16;
    blob = await encodeMp3(samples, sampleRate, kbps);
  }

  if (blob.size > COMPRESS_THRESHOLD_BYTES) {
    throw new Error(
      `Could not compress below ${formatBytes(COMPRESS_THRESHOLD_BYTES)}. Try a shorter clip or lower-quality source file.`
    );
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const out = new File([blob], `${base}.compressed.mp3`, {
    type: "audio/mpeg",
    lastModified: Date.now(),
  });

  return {
    file: out,
    compressed: true,
    originalSize,
    finalSize: out.size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
