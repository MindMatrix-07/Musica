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

async function decodeAudio(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const arrayBuffer = await file.arrayBuffer();
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

/** Fallback when MP3 encoder fails — opus-in-webm, smaller files. */
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

export type CompressResult = {
  file: File;
  compressed: boolean;
  originalSize: number;
  finalSize: number;
};

/**
 * Re-encode large MP3/WAV to a smaller file for upload.
 */
export async function compressAudioIfNeeded(file: File): Promise<CompressResult> {
  const originalSize = file.size;
  if (file.size <= COMPRESS_THRESHOLD_BYTES) {
    return { file, compressed: false, originalSize, finalSize: file.size };
  }

  const decoded = await decodeAudio(file);
  const sampleRate = 22050;
  const samples = await resampleToMono(decoded, sampleRate);

  let blob: Blob;
  let ext = "mp3";
  let mime = "audio/mpeg";

  try {
    let kbps = 96;
    blob = await encodeMp3(samples, sampleRate, kbps);
    while (blob.size > COMPRESS_THRESHOLD_BYTES && kbps > 32) {
      kbps -= 16;
      blob = await encodeMp3(samples, sampleRate, kbps);
    }
  } catch {
    blob = await encodeViaMediaRecorder(decoded, sampleRate, 48000);
    ext = blob.type.includes("ogg") ? "ogg" : "webm";
    mime = blob.type;
  }

  if (blob.size > COMPRESS_THRESHOLD_BYTES) {
    try {
      blob = await encodeViaMediaRecorder(decoded, sampleRate, 32000);
      ext = blob.type.includes("ogg") ? "ogg" : "webm";
      mime = blob.type;
    } catch {
      /* use last blob */
    }
  }

  if (blob.size > COMPRESS_THRESHOLD_BYTES) {
    throw new Error(
      `Could not compress below ${formatBytes(COMPRESS_THRESHOLD_BYTES)}. Try a shorter clip.`
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
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
