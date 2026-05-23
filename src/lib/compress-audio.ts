import { Mp3Encoder } from "@breezystack/lamejs";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const MAX_DIRECT_UPLOAD_BYTES = 3.6 * 1024 * 1024;
const MAX_COMPRESSED_UPLOAD_BYTES = 4.1 * 1024 * 1024;
const MP3_BLOCK_SIZE = 1152;

const COMPRESSION_PRESETS = [
  { sampleRate: 22_050, kbps: 32, label: "MP3 mono 32 kbps" },
  { sampleRate: 16_000, kbps: 24, label: "MP3 mono 24 kbps" },
  { sampleRate: 16_000, kbps: 16, label: "MP3 mono 16 kbps" },
] as const;

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

function audioBufferToMonoPcm(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }

  const mono = new Float32Array(buffer.length);
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i += 1) {
      mono[i] += data[i] / buffer.numberOfChannels;
    }
  }
  return mono;
}

function floatToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("This browser cannot compress audio before upload.");
  }

  const context = new AudioContextCtor();
  try {
    const data = await file.arrayBuffer();
    return await context.decodeAudioData(data.slice(0));
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function resampleToMono(
  source: AudioBuffer,
  sampleRate: number
): Promise<Int16Array> {
  const duration = source.duration;
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const offline = new OfflineAudioContext(1, frameCount, sampleRate);
  const sourceNode = offline.createBufferSource();
  sourceNode.buffer = source;
  sourceNode.connect(offline.destination);
  sourceNode.start();

  const rendered = await offline.startRendering();
  return floatToInt16(audioBufferToMonoPcm(rendered));
}

function encodeMp3(pcm: Int16Array, sampleRate: number, kbps: number): Blob {
  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < pcm.length; offset += MP3_BLOCK_SIZE) {
    const block = pcm.subarray(offset, offset + MP3_BLOCK_SIZE);
    const encoded = encoder.encodeBuffer(block);
    if (encoded.length > 0) chunks.push(encoded);
  }

  const finalChunk = encoder.flush();
  if (finalChunk.length > 0) chunks.push(finalChunk);
  return new Blob(chunks, { type: "audio/mpeg" });
}

function makeMp3File(blob: Blob, originalName: string): File {
  const baseName = originalName.replace(/\.[^/.]+$/, "") || "musica-upload";
  return new File([blob], `${baseName}-compressed.mp3`, {
    type: "audio/mpeg",
    lastModified: Date.now(),
  });
}

export async function compressAudioIfNeeded(file: File): Promise<CompressionResult> {
  if (file.size <= MAX_DIRECT_UPLOAD_BYTES) {
    return {
      file,
      compressed: false,
      originalSize: file.size,
      finalSize: file.size,
    };
  }

  const decoded = await decodeAudioFile(file);
  let smallest: { file: File; label: string } | null = null;

  for (const preset of COMPRESSION_PRESETS) {
    const pcm = await resampleToMono(decoded, preset.sampleRate);
    const blob = encodeMp3(pcm, preset.sampleRate, preset.kbps);
    const compressedFile = makeMp3File(blob, file.name);

    if (!smallest || compressedFile.size < smallest.file.size) {
      smallest = { file: compressedFile, label: preset.label };
    }

    if (compressedFile.size <= MAX_COMPRESSED_UPLOAD_BYTES) {
      return {
        file: compressedFile,
        compressed: true,
        originalSize: file.size,
        finalSize: compressedFile.size,
        qualityLabel: preset.label,
      };
    }
  }

  if (smallest) {
    throw new Error(
      `Compressed audio is still too large for Vercel (${formatBytes(
        smallest.file.size
      )}). Try a shorter clip, or use the PC app for longer songs.`
    );
  }

  return {
    file,
    compressed: false,
    originalSize: file.size,
    finalSize: file.size,
    qualityLabel: "No compression was applied",
  };
}
