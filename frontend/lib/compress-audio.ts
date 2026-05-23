import { yieldToMain } from "@/lib/ui-batch";

/**
 * Upload limits (align with backend/app/config.py on Vercel).
 * Vercel request body ~4.5 MB; server accepts up to 4 MB file bytes.
 */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;
/** Target encoded size — leaves room for multipart form overhead. */
export const COMPRESS_TARGET_BYTES = Math.floor(UPLOAD_MAX_BYTES * 0.92);

const SAMPLE_RATE = 32000;
const MP3_KBPS_MAX = 160;
const MP3_KBPS_MIN = 88;
const MP3_KBPS_STEP = 8;
const OPUS_BITS_MAX = 128_000;
const OPUS_BITS_MIN = 64_000;
const ENCODE_YIELD_EVERY_BLOCKS = 64;

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

function estimateMp3Kbps(durationSec: number, targetBytes: number): number {
  if (durationSec <= 0) return MP3_KBPS_MAX;
  const raw = Math.floor((targetBytes * 8) / durationSec / 1000);
  const stepped =
    Math.round(Math.min(MP3_KBPS_MAX, Math.max(MP3_KBPS_MIN, raw)) / MP3_KBPS_STEP) *
    MP3_KBPS_STEP;
  return stepped;
}

async function decodeAudio(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
    await yieldToMain();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await ctx.close();
  }
}

async function resampleToMono(
  buffer: AudioBuffer,
  sampleRate: number
): Promise<Int16Array> {
  const length = Math.ceil(buffer.duration * sampleRate);
  const offline = new OfflineAudioContext(1, length, sampleRate);
  const src = offline.createBufferSource();
  const mono = offline.createBuffer(1, buffer.length, buffer.sampleRate);
  const mixed = mixToMono(buffer);
  mono.copyToChannel(new Float32Array(mixed), 0);
  src.buffer = mono;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return floatTo16BitPCM(rendered.getChannelData(0));
}

async function loadMp3Encoder() {
  const lame = await import("@breezystack/lamejs");
  return lame.Mp3Encoder;
}

async function encodeMp3(
  samples: Int16Array,
  sampleRate: number,
  kbps: number
): Promise<Blob> {
  const Mp3Encoder = await loadMp3Encoder();
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const block = 1152;
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < samples.length; i += block) {
    if (i > 0 && (i / block) % ENCODE_YIELD_EVERY_BLOCKS === 0) {
      await yieldToMain();
    }
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
    merged.set(
      new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
      offset
    );
    offset += chunk.length;
  }
  return new Blob([merged], { type: "audio/mpeg" });
}

/** Estimate bitrate, encode at most a few times, yield between attempts. */
async function encodeMp3BestFit(
  samples: Int16Array,
  sampleRate: number,
  targetBytes: number,
  durationSec: number
): Promise<{ blob: Blob; kbps: number }> {
  let kbps = estimateMp3Kbps(durationSec, targetBytes);
  let smallest: { blob: Blob; kbps: number } | null = null;

  for (let attempt = 0; attempt < 4 && kbps >= MP3_KBPS_MIN; attempt++) {
    await yieldToMain();
    const blob = await encodeMp3(samples, sampleRate, kbps);
    if (blob.size <= targetBytes) {
      return { blob, kbps };
    }
    if (!smallest || blob.size < smallest.blob.size) {
      smallest = { blob, kbps };
    }
    kbps -= MP3_KBPS_STEP;
  }

  if (smallest) return smallest;
  throw new Error("MP3 encoding failed");
}

async function encodeViaMediaRecorder(
  buffer: AudioBuffer,
  sampleRate: number,
  audioBitsPerSecond: number
): Promise<Blob> {
  const ctx = new AudioContext({ sampleRate });
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();

  const offline = new OfflineAudioContext(1, buffer.length, sampleRate);
  const mono = offline.createBuffer(1, buffer.length, buffer.sampleRate);
  mono.copyToChannel(new Float32Array(mixToMono(buffer)), 0);
  source.buffer = mono;

  const mimeCandidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
  if (!mimeType) {
    throw new Error("No supported audio recording format for compression.");
  }

  return new Promise((resolve, reject) => {
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(dest.stream, {
      mimeType,
      audioBitsPerSecond,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("MediaRecorder failed"));
    recorder.onstop = async () => {
      await ctx.close();
      resolve(new Blob(chunks, { type: mimeType }));
    };

    source.connect(dest);
    recorder.start(100);
    source.onended = () => {
      if (recorder.state === "recording") recorder.stop();
    };
    source.start(0);
  });
}

async function encodeOpusBestFit(
  decoded: AudioBuffer,
  sampleRate: number,
  targetBytes: number
): Promise<Blob> {
  const durationSec = decoded.duration;
  const estimated =
    Math.min(
      OPUS_BITS_MAX,
      Math.max(OPUS_BITS_MIN, Math.floor((targetBytes * 8) / durationSec))
    ) || OPUS_BITS_MAX;

  let bps = estimated;
  let smallest: Blob | null = null;
  for (let attempt = 0; attempt < 3 && bps >= OPUS_BITS_MIN; attempt++) {
    await yieldToMain();
    const blob = await encodeViaMediaRecorder(decoded, sampleRate, bps);
    if (blob.size <= targetBytes) return blob;
    if (!smallest || blob.size < smallest.size) smallest = blob;
    bps -= 24_000;
  }
  if (smallest) return smallest;
  throw new Error("Opus encoding failed");
}

export type CompressResult = {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
  qualityLabel?: string;
};

export async function compressAudioIfNeeded(file: File): Promise<CompressResult> {
  const originalSize = file.size;
  if (file.size <= COMPRESS_TARGET_BYTES) {
    return { file, compressed: false, originalSize, finalSize: file.size };
  }

  await yieldToMain();
  const decoded = await decodeAudio(file);
  const durationSec = decoded.duration;
  const samples = await resampleToMono(decoded, SAMPLE_RATE);

  let blob: Blob;
  let ext = "mp3";
  let mime = "audio/mpeg";
  let qualityLabel = "";

  try {
    const { blob: mp3, kbps } = await encodeMp3BestFit(
      samples,
      SAMPLE_RATE,
      COMPRESS_TARGET_BYTES,
      durationSec
    );
    blob = mp3;
    qualityLabel = `${kbps} kbps mono MP3 @ ${SAMPLE_RATE / 1000} kHz`;
  } catch {
    await yieldToMain();
    blob = await encodeOpusBestFit(decoded, SAMPLE_RATE, COMPRESS_TARGET_BYTES);
    ext = blob.type.includes("ogg") ? "ogg" : "webm";
    mime = blob.type;
    qualityLabel = `Opus (${ext})`;
  }

  if (blob.size > UPLOAD_MAX_BYTES) {
    try {
      blob = await encodeOpusBestFit(decoded, SAMPLE_RATE, COMPRESS_TARGET_BYTES);
      ext = blob.type.includes("ogg") ? "ogg" : "webm";
      mime = blob.type;
      qualityLabel = `Opus fallback (${ext})`;
    } catch {
      /* use last blob */
    }
  }

  if (blob.size > UPLOAD_MAX_BYTES) {
    throw new Error(
      `Could not fit audio under ${formatBytes(UPLOAD_MAX_BYTES)} for upload. Try a shorter clip or lower-resolution source.`
    );
  }

  const base = file.name.replace(/\.[^.]+$/, "");
  const out = new File([blob], `${base}.compressed.${ext}`, {
    type: mime,
    lastModified: Date.now(),
  });

  return {
    file: out,
    compressed: true,
    originalSize,
    finalSize: out.size,
    qualityLabel,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
