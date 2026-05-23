import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import os from "os";
import { GoogleGenAI } from "@google/genai";
import { OpenAI } from "openai";

// Initialize multer for handling audio file uploads
// Use os.tmpdir() to ensure write permission in serverless environments like Vercel
const uploadDir = path.join(os.tmpdir(), "tmp_uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// Official guideline sources & files paths
const groundingDir = path.join(process.cwd(), "grounding");
let webGuidelines = "";
let extendedGuidelines = "";

try {
  const webPath = path.join(groundingDir, "musixmatch_web_guidelines.txt");
  if (fs.existsSync(webPath)) {
    webGuidelines = fs.readFileSync(webPath, "utf-8");
  }
} catch (e) {
  console.error("Error reading web guidelines:", e);
}

try {
  const extPath = path.join(groundingDir, "musixmatch_extended_guidelines.txt");
  if (fs.existsSync(extPath)) {
    extendedGuidelines = fs.readFileSync(extPath, "utf-8");
  }
} catch (e) {
  console.error("Error reading extended guidelines:", e);
}

const GUIDELINES_SOURCES = `
Official sources (always apply web + extended together):
- Web: https://community.musixmatch.com/guidelines?lng=en
- Extended: https://docs.google.com/document/d/1njyoifp2cyG-IQu0495eX1Mo0Hp2qy-vl4IeHX0DSCw/preview
`;

const combinedGuidelines = `
${GUIDELINES_SOURCES}

=== MUSIXMATCH WEB GUIDELINES (all sections: Transcribe, Format, Sync, Tag Structure, Tag Performers, Translate) ===
${webGuidelines}

=== MUSIXMATCH EXTENDED GUIDELINES ===
${extendedGuidelines}
`;

// System Instruction and prompts
const SYSTEM_INSTRUCTION = `You are an automated Elite Musixmatch Curator. Your absolute priority is to transcribe and structure lyrics with 100% compliance to official Musixmatch Curation Policies provided in the grounding reference files.

CRITICAL TRANSCRIPTION & VALIDATION RULES:
1. STRUCTURAL TAGS: Identify and label song parts using capitalized bracket tags on their own line exactly when structural arrangement shifts occur (e.g., [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro]). Never guess.
2. TEXT CASE & GRAMMAR: Follow standard title case or sentence case grammar rules per standard curation policy. No trailing punctuation at the end of lines unless structurally essential.
3. REPETITIONS: Transcribe all repeated lines in full. Never use placeholders or multipliers like "Chorus x2".
4. NON-LYRICAL VOCALS: Do not transcribe instrumental improvisations or vocal guitar mimics. Format distinct vocalizations (like distinct background humming, "Oohs", or "Aahs") in lowercase parentheses on their own line or embedded only if they are core to the melody.
5. BACKGROUND/BACKING VOCALS: If backing vocals run parallel to primary vocals, isolate them inside parentheses () exactly matching their line placement.`;

const TRANSCRIPTION_SYSTEM = `You are a Musixmatch Transcription Specialist. Your ONLY job is to hear the audio and write accurate lyric lines.

RULES:
- Do NOT add structure tags ([Verse], [Chorus], #INTRO, etc.).
- Do NOT add commentary, titles, or metadata.
- Transcribe every repeated line in full (no "x2" shortcuts).
- Include backing vocals in parentheses () on the same line when parallel to lead.
- Follow formatting rules from the combined official Musixmatch guidelines below.
- Output plain lyric lines only, ready for a separate structure-tagging pass.`;

const TRANSCRIPTION_TASK = `Listen to the attached audio in full. Write the complete lyrics with perfect wording and formatting.

Output ONLY the lyric lines (no structure section tags).

{combined_guidelines}
{training_block}
{user_instructions_block}`;

const STRUCTURE_SYSTEM = `You are a Musixmatch Structure Tagging Specialist. You do NOT write or rewrite lyrics.

YOUR ONLY TASKS:
1. Listen to the audio and read the draft lyrics provided.
2. Insert structure tags on their own lines when sections change: [Intro], [Verse 1], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Hook], [Outro].
3. Add #INSTRUMENTAL on its own line only for 15+ seconds without vocals, between sections (never at song start/end, never inside a verse).
4. Add a blank line after each #INSTRUMENTAL before the next structure tag.

FORBIDDEN:
- Changing, deleting, or re-ordering any lyric words from the draft.
- Fixing "creative" wording — only add tags and blank lines for instrumentals.
- Guessing tags without musical/lyrical evidence in the audio.

Always apply BOTH the web and extended Musixmatch guidelines together.`;

const STRUCTURE_TASK = `Apply structure tags to the draft lyrics below using the attached audio as ground truth.

Return ONLY the full lyrics with structure tags added (Markdown). No explanation.

--- DRAFT LYRICS (do not edit words) ---
{draft_lyrics}

{combined_guidelines}
{training_block}
{user_instructions_block}`;

const USER_TASK_TEMPLATE = `Listen to the attached audio track in full. Produce publication-ready lyrics as clean Markdown.

Requirements:
- Output ONLY the curated lyrics in Markdown (no preamble or meta commentary).
- Use structural tags on their own lines: [Intro], [Verse 1], [Pre-Chorus], [Chorus], [Bridge], [Outro], etc.
- Apply ALL rules from BOTH grounding references below together with the system policy.
- Where Musixmatch uses #INSTRUMENTAL for long instrumental breaks, use a line: #INSTRUMENTAL (between sections only).

--- GROUNDING: WEB GUIDELINES (community.musixmatch.com) ---
{web_guidelines}

--- GROUNDING: EXTENDED GUIDELINES ---
{extended_guidelines}
{training_block}
{user_instructions_block}`;

const USER_INSTRUCTIONS_BLOCK = `
--- ADDITIONAL CURATOR INSTRUCTIONS (from user) ---
Follow these when compatible with official Musixmatch policies above. If anything conflicts, official policies win.

{user_prompt}`;

function buildTrainingBlock(messages: string[]): string {
  if (!messages || messages.length === 0) return "";
  const joined = messages.map((m) => `- ${m}`).join("\n");
  const text = `
--- YOUR TRAINED PREFERENCES (from saved messages) ---
Apply these consistently when compatible with Musixmatch official rules:

${joined}
`;
  if (text.length > 8000) {
    return text.substring(0, 8000) + "\n…";
  }
  return text;
}

function buildUserBlock(userPrompt?: string): string {
  const text = (userPrompt || "").trim();
  if (!text) return "";
  return USER_INSTRUCTIONS_BLOCK.replace("{user_prompt}", text);
}

// Multi-model try loop implementation
async function streamGenerate(
  ai: GoogleGenAI,
  modelCandidates: string[],
  contents: any[],
  systemInstruction: string,
  temperature: number,
  onChunk: (text: string) => void
) {
  let lastError: any = null;
  for (const modelId of modelCandidates) {
    try {
      const responseStream = await ai.models.generateContentStream({
        model: modelId,
        contents: contents,
        config: {
          systemInstruction,
          temperature,
        },
      });
      for await (const chunk of responseStream) {
        if (chunk.text) {
          onChunk(chunk.text);
        }
      }
      return; // Succeeded!
    } catch (err) {
      console.warn(`Model candidate ${modelId} failed:`, err);
      lastError = err;
    }
  }
  if (lastError) {
    throw new Error(
      `Gemini models unavailable (tried: ${modelCandidates.join(", ")}): ${
        lastError.message || lastError
      }`
    );
  }
  throw new Error("No models available for generation");
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

  // Metadata check configuration
  app.get("/api/config", (req, res) => {
    res.json({
      hasGeminiKey:
        typeof process.env.GEMINI_API_KEY === "string" &&
        process.env.GEMINI_API_KEY.length > 0,
    });
  });

  // Streaming Curation API Endpoint
  app.post("/api/curate/stream", upload.single("file"), async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ detail: "Audio file is required" });
    }

    const modelSelection = req.body.model || "gemini-3.5-flash";
    const temperature = parseFloat(req.body.temperature || "0.1");
    const splitStructure = req.body.split_structure !== "false";
    const provider = req.body.provider || "gemini";
    const userPrompt = req.body.user_prompt || "";

    let trainingMessages: string[] = [];
    try {
      if (req.body.training_messages) {
        trainingMessages = JSON.parse(req.body.training_messages);
      }
    } catch (e) {
      // fallback if lines
      if (typeof req.body.training_messages === "string") {
        trainingMessages = req.body.training_messages
          .split("\n")
          .map((line: string) => line.trim())
          .filter(Boolean);
      }
    }

    const trainingBlock = buildTrainingBlock(trainingMessages);
    const userBlock = buildUserBlock(userPrompt);

    // Resolve API keys (Header first, then environment fallback)
    const geminiApiKey =
      req.get("X-Gemini-Api-Key") || process.env.GEMINI_API_KEY;
    const openaiApiKey =
      req.get("X-OpenAI-Api-Key") || process.env.OPENAI_API_KEY;

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sendEvent = (event: any) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    };

    if (provider === "openai") {
      if (!openaiApiKey) {
        sendEvent({
          type: "error",
          message: "OpenAI API key required. Add it in Settings.",
        });
        res.end();
        fs.unlink(file.path, () => {});
        return;
      }

      try {
        sendEvent({ type: "status", message: "Connecting to OpenAI…" });
        sendEvent({
          type: "status",
          message: "OpenAI: transcribing audio (Whisper)…",
        });

        const openai = new OpenAI({ apiKey: openaiApiKey });

        // Call Whisper for transcription
        const transcription = await openai.audio.transcriptions.create({
          file: fs.createReadStream(file.path),
          model: "whisper-1",
        });

        const draft = (transcription.text || "").trim();
        if (!draft) {
          throw new Error("Whisper returned empty transcription");
        }

        let pipeline: string[] = [];
        let markdown = "";

        if (!splitStructure) {
          pipeline.push("single-pass");
          sendEvent({
            type: "pass_start",
            pass: "single-pass",
            model: "Whisper",
            message: "OpenAI transcription (Whisper Only)",
          });
          // simulate chunks of stream
          for (let i = 0; i < draft.length; i += 80) {
            sendEvent({
              type: "chunk",
              pass: "single-pass",
              text: draft.substring(i, i + 80),
            });
            await new Promise((r) => setTimeout(r, 10));
          }
          sendEvent({ type: "pass_end", pass: "single-pass", draft });
          markdown = draft;
        } else {
          // Pass 1: Whisper output streaming
          sendEvent({
            type: "pass_start",
            pass: "transcription",
            model: "Whisper",
            message: "Pass 1 · Lyrics (via Whisper)",
          });
          for (let i = 0; i < draft.length; i += 80) {
            sendEvent({
              type: "chunk",
              pass: "transcription",
              text: draft.substring(i, i + 80),
            });
            await new Promise((r) => setTimeout(r, 10));
          }
          pipeline.push("transcription");
          sendEvent({ type: "pass_end", pass: "transcription", draft });

          // Pass 2: GPT-4o Structure tagging
          const structUserPrompt = STRUCTURE_TASK.replace(
            "{draft_lyrics}",
            draft
          )
            .replace("{combined_guidelines}", combinedGuidelines)
            .replace("{training_block}", trainingBlock)
            .replace("{user_instructions_block}", userBlock);

          sendEvent({
            type: "pass_start",
            pass: "structure",
            model: "gpt-4o",
            message: "Pass 2 · Structure tags (gpt-4o)",
          });

          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: STRUCTURE_SYSTEM },
              { role: "user", content: structUserPrompt },
            ],
            temperature: 0.1,
            stream: true,
          });

          let structParts: string[] = [];
          for await (const chunk of response) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              structParts.push(text);
              sendEvent({ type: "chunk", pass: "structure", text });
            }
          }

          markdown = structParts.join("").trim();
          pipeline.push("structure");
          sendEvent({ type: "pass_end", pass: "structure" });
        }

        sendEvent({
          type: "done",
          markdown,
          pipeline,
          model: modelSelection,
          temperature,
          split_structure: splitStructure,
          provider: "openai",
        });
      } catch (err: any) {
        console.error("OpenAI stream error:", err);
        sendEvent({ type: "error", message: err.message || String(err) });
      } finally {
        fs.unlink(file.path, () => {});
        res.end();
      }
      return;
    }

    // Default: Gemini Integration using official @google/genai
    if (!geminiApiKey) {
      sendEvent({
        type: "error",
        message: "Gemini API key required. Add it in Settings or Secrets.",
      });
      res.end();
      fs.unlink(file.path, () => {});
      return;
    }

    let uploadedFile: any = null;
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    try {
      sendEvent({
        type: "status",
        message: "Connecting to Google AI Studio…",
      });
      sendEvent({
        type: "status",
        message: "Uploading audio to Gemini Files API…",
      });

      // Upload file to GenAI Files API
      uploadedFile = await ai.files.upload({
        file: file.path,
        config: {
          mimeType: file.mimetype,
        },
      });

      // Polling to wait for uploaded file state to become ACTIVE
      const deadline = Date.now() + 120_000;
      let active = false;
      while (Date.now() < deadline) {
        const fileInfo = await ai.files.get({ name: uploadedFile.name });
        const state = String(fileInfo.state);
        if (state === "ACTIVE") {
          active = true;
          uploadedFile = fileInfo;
          break;
        }
        if (state === "FAILED") {
          throw new Error(`Gemini files processing failed: ${uploadedFile.name}`);
        }
        sendEvent({
          type: "status",
          message: `Google AI Studio: processing audio (${state})…`,
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (!active) {
        throw new Error("Timed out waiting for file to process in Gemini API");
      }

      sendEvent({
        type: "status",
        message: "Audio ready — streaming curation",
      });

      console.log("Gemini active file details:", {
        uri: uploadedFile?.uri,
        mimeType: uploadedFile?.mimeType || file.mimetype,
        name: uploadedFile?.name,
      });

      const filePart = {
        fileData: {
          fileUri: uploadedFile.uri,
          mimeType: uploadedFile.mimeType || file.mimetype,
        },
      };

      // Build model candidate sequence with valid non-deprecated models
      const isPro = modelSelection === "gemini-3.5-pro";
      const modelCandidates = isPro
        ? ["gemini-3.1-pro-preview", "gemini-3.5-flash"]
        : ["gemini-3.5-flash"];

      const label = isPro ? "gemini-3.5-pro" : "gemini-3.5-flash";
      const pipeline: string[] = [];
      let finalMarkdown = "";

      if (splitStructure) {
        // Pass 1: Lyrics Only
        const txPrompt = TRANSCRIPTION_TASK.replace(
          "{combined_guidelines}",
          combinedGuidelines
        )
          .replace("{training_block}", trainingBlock)
          .replace("{user_instructions_block}", userBlock);

        sendEvent({
          type: "pass_start",
          pass: "transcription",
          model: label,
          message: `Pass 1 · Lyrics transcription (${label})`,
        });

        let txParts: string[] = [];
        await streamGenerate(
          ai,
          modelCandidates,
          [filePart, txPrompt],
          TRANSCRIPTION_SYSTEM,
          temperature,
          (text) => {
            txParts.push(text);
            sendEvent({ type: "chunk", pass: "transcription", text });
          }
        );

        const draft = txParts.join("").trim();
        if (!draft) {
          throw new Error("Transcription pass returned empty output");
        }
        pipeline.push("transcription");
        sendEvent({ type: "pass_end", pass: "transcription", draft });

        // Pass 2: Structure tags adding
        const structPrompt = STRUCTURE_TASK.replace("{draft_lyrics}", draft)
          .replace("{combined_guidelines}", combinedGuidelines)
          .replace("{training_block}", trainingBlock)
          .replace("{user_instructions_block}", userBlock);

        sendEvent({
          type: "pass_start",
          pass: "structure",
          model: label,
          message: `Pass 2 · Structure tagging (${label})`,
        });

        let structParts: string[] = [];
        await streamGenerate(
          ai,
          modelCandidates,
          [filePart, structPrompt],
          STRUCTURE_SYSTEM,
          temperature,
          (text) => {
            structParts.push(text);
            sendEvent({ type: "chunk", pass: "structure", text });
          }
        );

        finalMarkdown = structParts.join("").trim();
        if (!finalMarkdown) {
          throw new Error("Structure pass returned empty output");
        }
        pipeline.push("structure");
        sendEvent({ type: "pass_end", pass: "structure" });
      } else {
        // Single Pass falling back
        const userText = USER_TASK_TEMPLATE.replace(
          "{web_guidelines}",
          webGuidelines
        )
          .replace("{extended_guidelines}", extendedGuidelines)
          .replace("{training_block}", trainingBlock)
          .replace("{user_instructions_block}", userBlock);

        sendEvent({
          type: "pass_start",
          pass: "single-pass",
          model: label,
          message: `Single-pass curation (${label})`,
        });

        let parts: string[] = [];
        await streamGenerate(
          ai,
          modelCandidates,
          [filePart, userText],
          SYSTEM_INSTRUCTION,
          temperature,
          (text) => {
            parts.push(text);
            sendEvent({ type: "chunk", pass: "single-pass", text });
          }
        );

        finalMarkdown = parts.join("").trim();
        if (!finalMarkdown) {
          throw new Error("Model returned empty output");
        }
        pipeline.push("single-pass");
        sendEvent({ type: "pass_end", pass: "single-pass", draft: finalMarkdown });
      }

      sendEvent({
        type: "done",
        markdown: finalMarkdown,
        pipeline,
        model: modelSelection,
        temperature,
        split_structure: splitStructure,
        provider: "gemini",
      });
    } catch (err: any) {
      console.error("Gemini stream error:", err);
      sendEvent({ type: "error", message: err.message || String(err) });
    } finally {
      // Safely delete file from disk and cloud bucket storage
      fs.unlink(file.path, () => {});
      if (uploadedFile && ai) {
        try {
          await ai.files.delete({ name: uploadedFile.name });
        } catch (e) {
          console.error("Error deleting file from Gemini Files API:", e);
        }
      }
      res.end();
    }
  });

export { app };

async function startServer() {
  const PORT = Number(process.env.PORT || 3000);

  // Serve static assets in production or mount Vite middleware in development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(__dirname, "index.html"))
      ? __dirname
      : path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer().catch((e) => {
    console.error("Server startup crash:", e);
  });
}
