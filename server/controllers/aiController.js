import OpenAI from "openai";
import sql from "../configs/db.js";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import fs from 'fs'
import pdf from 'pdf-parse/lib/pdf-parse.js'
import { randomUUID } from 'crypto'

const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";
/** Default to a lighter model to reduce free-tier RPM / quota hits vs 2.0-flash. */
const GEMINI_CHAT_MODEL =
  process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash-lite";

const POLLINATIONS_TEXT_MAX_CHARS =
  Number(process.env.POLLINATIONS_TEXT_MAX_CHARS) || 3500;
const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-2.5-flash-image";
const GEMINI_REST_BASE =
  process.env.GEMINI_REST_BASE?.trim() ||
  "https://generativelanguage.googleapis.com/v1beta";

function geminiApiKey() {
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    ""
  );
}

let geminiClient = null;

/** Lazy OpenAI-compatible client for Google Gemini API. */
function getGeminiOpenAI() {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    const err = new Error(
      "AI key not configured — set GEMINI_API_KEY or GOOGLE_AI_API_KEY in server/.env."
    );
    err.code = "NO_AI_KEY";
    throw err;
  }
  if (!geminiClient) {
    geminiClient = new OpenAI({
      apiKey,
      baseURL: GEMINI_OPENAI_BASE,
    });
  }
  return geminiClient;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when Google/Gemini signals quota or RPM exhaustion (often HTTP 429). */
function isRateLimitOrQuotaError(error) {
  const st = error?.status ?? error?.response?.status;
  if (st === 429) return true;
  const msg = `${error?.message ?? ""}${error?.code ?? ""}`.toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests")
  );
}

/**
 * Gemini chat via OpenAI-compatible API. Handles free-tier bursts: brief wait +
 * alternate models (often have separate quota buckets).
 */
async function geminiChatCompletionsCreate(body) {
  const client = getGeminiOpenAI();
  const fallbacks =
    process.env.GEMINI_MODEL_FALLBACKS?.trim() ||
    "gemini-2.0-flash,gemini-2.5-flash-lite";
  const modelChain = [
    GEMINI_CHAT_MODEL,
    ...fallbacks.split(",").map((s) => s.trim()).filter(Boolean),
  ];
  const models = [...new Set(modelChain)];
  const waitMs = Number(process.env.GEMINI_RATE_LIMIT_WAIT_MS) || 6000;
  const maxAttempts = Number(process.env.GEMINI_RATE_LIMIT_MAX_ATTEMPTS) || 3;

  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await client.chat.completions.create({ ...body, model });
      } catch (err) {
        lastErr = err;
        const st = err?.status ?? err?.response?.status;
        if (isRateLimitOrQuotaError(err) && attempt < maxAttempts - 1) {
          await sleep(waitMs * (attempt + 1));
          continue;
        }
        if (isRateLimitOrQuotaError(err)) break;
        if (st === 404 || st === 400) break;
        throw err;
      }
    }
  }
  throw lastErr;
}

/** Last user message text from OpenAI-style chat body (string or simple multimodal). */
function userTextFromChatBody(body) {
  const msgs = body?.messages;
  if (!Array.isArray(msgs)) return "";
  const userMsgs = msgs.filter((m) => m.role === "user");
  const last = userMsgs[userMsgs.length - 1];
  const c = last?.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((p) =>
        typeof p === "object" && p && "text" in p ? String(p.text) : ""
      )
      .filter(Boolean)
      .join("\n");
  }
  return c != null ? String(c) : "";
}

/**
 * Free text via Pollinations (same family as default image fallback). No API key.
 * GET length is bounded — very long prompts (e.g. resume PDF text) skip this path.
 */
async function pollinationsGenerateText(prompt) {
  const truncated = prompt.slice(0, POLLINATIONS_TEXT_MAX_CHARS);
  const encoded = encodeURIComponent(truncated);
  const { data, status } = await axios.get(
    `https://text.pollinations.ai/${encoded}`,
    {
      timeout: 120000,
      responseType: "text",
      validateStatus: () => true,
      transformResponse: [(d) => d],
    }
  );
  if (status < 200 || status >= 300) {
    const err = new Error(`Pollinations text HTTP ${status}`);
    err.status = status;
    throw err;
  }
  const text = typeof data === "string" ? data.trim() : String(data).trim();
  if (!text || text.length < 2) {
    throw new Error("Pollinations returned empty text.");
  }
  if (/^<!doctype\b|^<html\b/i.test(text.slice(0, 200))) {
    throw new Error("Pollinations returned HTML instead of text.");
  }
  return text;
}

/**
 * Like image generation: try Gemini first, then Pollinations when quota/RPM is exhausted
 * (or when no Gemini key is set — optional dev-friendly path for short prompts).
 * Disable with ENABLE_POLLINATIONS_TEXT_FALLBACK=false.
 */
async function geminiChatCompletionsCreateWithFallback(body) {
  const prompt = userTextFromChatBody(body);
  const allowPoll =
    process.env.ENABLE_POLLINATIONS_TEXT_FALLBACK !== "false";
  const shortEnough =
    prompt.length > 0 && prompt.length <= POLLINATIONS_TEXT_MAX_CHARS;

  if (!geminiApiKey() && allowPoll && shortEnough) {
    const text = await pollinationsGenerateText(prompt);
    return {
      choices: [{ message: { content: text }, finish_reason: "stop" }],
    };
  }

  try {
    return await geminiChatCompletionsCreate(body);
  } catch (err) {
    if (
      !allowPoll ||
      !shortEnough ||
      (!isRateLimitOrQuotaError(err) && err?.code !== "NO_AI_KEY")
    ) {
      throw err;
    }
    try {
      console.warn(
        "Gemini chat unavailable for text; using Pollinations fallback:",
        err?.message ?? err
      );
      const text = await pollinationsGenerateText(prompt);
      return {
        choices: [{ message: { content: text }, finish_reason: "stop" }],
      };
    } catch (pollErr) {
      console.warn("Pollinations text fallback failed:", pollErr?.message);
      throw err;
    }
  }

  /* aiController*/
}

function sniffImageMime(buffer) {
  if (!buffer?.length) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "image/png";
  if (
    buffer.length >= 12 &&
    buffer.slice(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  return "image/png";
}

function extractGeminiInlineImage(parsed) {
  const parts =
    parsed?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    const mimeType =
      inline?.mimeType ||
      inline?.mime_type;
    const data = inline?.data;
    if (typeof mimeType === "string" && mimeType.startsWith("image/") && typeof data === "string") {
      return { mimeType, buffer: Buffer.from(data, "base64") };
    }
  }
  return null;
}

/** Gemini native image (`generateContent` + image modality). Throws on quota/config errors. */
async function geminiGenerateImageBuffer(prompt) {
  const key = geminiApiKey();
  if (!key) {
    const e = new Error("Gemini API key missing for image generation");
    e.code = "NO_AI_KEY";
    throw e;
  }
  const model = encodeURIComponent(GEMINI_IMAGE_MODEL);
  const url = `${GEMINI_REST_BASE}/models/${model}:generateContent`;
  const aspectRatio =
    process.env.GEMINI_IMAGE_ASPECT_RATIO?.trim() || "1:1";
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  };

  const { data, status } = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    timeout: 120000,
    validateStatus: () => true,
  });

  if (data?.error?.message) {
    const err = new Error(data.error.message);
    err.status = typeof data.error.code === "number" ? data.error.code : status;
    err.raw = data.error;
    throw err;
  }

  if (status < 200 || status >= 300) {
    const err = new Error(
      typeof data === "string" ? data : `Gemini image HTTP ${status}`
    );
    err.status = status;
    throw err;
  }

  const inline = extractGeminiInlineImage(data);
  if (!inline?.buffer?.length)
    throw new Error("Gemini returned no image data for this prompt.");
  return inline.buffer;
}

async function clipdropGenerateImageBuffer(prompt, clipdropKey) {
  const { data } = await axios.post(
    "https://clipdrop-api.co/text-to-image/v1",
    { prompt },
    {
      headers: { "x-api-key": clipdropKey },
      responseType: "arraybuffer",
      timeout: 120000,
    }
  );
  return Buffer.from(data);
}

async function pollinationsGenerateImageBuffer(prompt) {
  const truncated = prompt.slice(0, 950);
  const encoded = encodeURIComponent(truncated);
  const width = Number(process.env.POLLINATIONS_IMAGE_WIDTH || 1024);
  const height = Number(process.env.POLLINATIONS_IMAGE_HEIGHT || 1024);

  const { data } = await axios.get(
    `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true`,
    { responseType: "arraybuffer", timeout: 120000 }
  );

  const buffer = Buffer.from(data);
  if (!buffer.length || !looksLikeImageBytes(buffer))
    throw new Error("Pollinations returned an unusable response (likely not image data).");

  return buffer;
}

function looksLikeImageBytes(buf) {
  if (!buf?.length || buf.length < 4) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8) return true;
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return true;
  const head = buf.slice(0, Math.min(buf.length, 512)).toString("utf8");
  if (/<!doctype\b|<html\b|<body\b/i.test(head)) return false;
  return buf.length >= 2048;
}

/**
 * Comma-separated: gemini | clipdrop | pollinations
 * Default uses Pollinations first so local / free-tier projects work without Clipdrop credits
 * or Gemini image billing. Override with IMAGE_GENERATION_PROVIDERS=gemini,clipdrop,pollinations when needed.
 */
function imageProviderOrder() {
  const configured = process.env.IMAGE_GENERATION_PROVIDERS?.trim();
  const fallback = ["pollinations", "gemini", "clipdrop"];
  if (!configured) return fallback;
  const list = configured
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : fallback;
}

const insertCreation = async ({ userId, prompt, content, type, publish = false }) => {
  const clerkUserId = userId != null ? String(userId) : ''
  await sql`
    INSERT INTO creations (id, user_id, prompt, content, type, publish)
    VALUES (${randomUUID()}, ${clerkUserId}, ${prompt}, ${content}, ${type}, ${publish})
  `
}

/** Axios may use responseType: arraybuffer — parse JSON/text for provider messages */
function parseProviderBody(data) {
  if (data == null) return null
  if (typeof data === "object" && !Buffer.isBuffer(data)) return data
  const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data)
  try {
    const parsed = JSON.parse(text)
    return typeof parsed === "object" && parsed !== null ? parsed : null
  } catch {
    return text.trim() ? { message: text } : null
  }
}

const getErrorDetails = (error) => {
  const status = error?.response?.status ?? error?.status
  const raw = error?.response?.data

  let message = error?.message || "Unknown error"
  if (status) message += ` (status ${status})`

  const payload = parseProviderBody(raw)
  if (payload) {
    const extra =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : null
    if (extra) message += ` - ${extra}`
    else if (typeof raw === "string" || Buffer.isBuffer(raw)) {
      try {
        message += ` - ${Buffer.isBuffer(raw) ? raw.toString("utf8") : raw}`
      } catch {
        message += " - [response body]"
      }
    }
  }

  return { status, message, data: payload, raw }
}

const handleAiError = (res, error) => {
  if (error?.code === "NO_AI_KEY") {
    return res.status(503).json({
      success: false,
      message:
        error.message ||
        "AI is not configured. Set GEMINI_API_KEY (or GOOGLE_AI_API_KEY) in the server environment.",
    });
  }
  const { status, data } = getErrorDetails(error)
  console.error("AI controller error:", error?.message ?? error)

  let message =
    (typeof data?.message === "string" && data.message) ||
    (typeof data?.error === "string" && data.error) ||
    error?.message ||
    "An error occurred while processing the AI request."

  if (status === 429 || error?.status === 429)
    message =
      "Gemini rate limit or free-tier quota exhausted. Wait ~1 minute and retry; use a lighter model via GEMINI_MODEL / GEMINI_MODEL_FALLBACKS, or enable billing in Google AI Studio (https://aistudio.google.com/)."

  // Clipdrop returns 402 when out of credits; don't surface that as HTTP 500
  const upstream = status ?? error?.status
  let httpStatus = 500
  if (upstream === 429) httpStatus = 429
  else if (upstream === 402)
    httpStatus = 402
  else if (upstream >= 400 && upstream < 500)
    httpStatus = 502
  else if (upstream >= 500) httpStatus = 502

  if (
    upstream === 402 &&
    !message.toLowerCase().includes("credit") &&
    !message.toLowerCase().includes("payment")
  )
    message =
      "Image provider billing or credits are exhausted. Top up Clipdrop credits or verify CLIPDROP_API_KEY."

  return res.status(httpStatus).json({ success: false, message })
}

export const generateArticle = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { prompt, length } = req.body;

        const maxTokens = Math.min(Math.max(Number(length) || 2048, 256), 8192)
        const response = await geminiChatCompletionsCreateWithFallback({
            messages: [{
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: maxTokens,
        });

        const content = response?.choices?.[0]?.message?.content || response?.choices?.[0]?.text || ''

        await insertCreation({ userId, prompt, content, type: 'article' })

        res.json({ success: true, content })


    } catch (error) {
        return handleAiError(res, error)
    }
}

export const generateBlogTitle = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { prompt } = req.body;

        const response = await geminiChatCompletionsCreateWithFallback({
            messages: [{ role: "user", content: prompt, } ],
            temperature: 0.7,
            max_tokens: 100,
        });

        const content = response?.choices?.[0]?.message?.content || response?.choices?.[0]?.text || ''

        await insertCreation({ userId, prompt, content, type: 'blog-title' })

        res.json({ success: true, content })


    } catch (error) {
        return handleAiError(res, error)
    }
}


export const generateImage = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { prompt, publish } = req.body;

        if (!prompt || typeof prompt !== "string") {
          return res
            .status(400)
            .json({ success: false, message: "Prompt is required for image generation." });
        }

        const clipdropKey = process.env.CLIPDROP_API_KEY?.trim()
        const hasGeminiForImage = !!geminiApiKey()
        const order = imageProviderOrder();
        /** @type {Array<{provider:string,detail:string}>} */
        const failures = [];
        /** @type {Buffer | null} */
        let rawBuffer = null;
        /** @type {string | null} */
        let winningProvider = null;

        const allowPollinations =
          process.env.ENABLE_POLLINATIONS_FALLBACK !== "false";

        for (const provider of order) {
          if (provider === "pollinations" && !allowPollinations) continue;
          try {
            if (provider === "gemini") {
              if (!hasGeminiForImage) continue;
              rawBuffer = await geminiGenerateImageBuffer(prompt);
              winningProvider = "gemini";
              break;
            }
            if (provider === "clipdrop") {
              if (!clipdropKey) continue;
              rawBuffer = await clipdropGenerateImageBuffer(prompt, clipdropKey);
              winningProvider = "clipdrop";
              break;
            }
            if (provider === "pollinations") {
              rawBuffer = await pollinationsGenerateImageBuffer(prompt);
              winningProvider = "pollinations";
              break;
            }
          } catch (err) {
            const parsedClip = parseProviderBody(err?.response?.data);
            const detail =
              (typeof parsedClip?.error === "string"
                ? parsedClip.error
                : null) ||
              err?.response?.data?.error?.message ||
              err?.message ||
              "Unknown provider error";
            failures.push({
              provider,
              detail:
                typeof detail === "string" ? detail : JSON.stringify(detail),
            });
            continue;
          }
        }

        if (!rawBuffer || !winningProvider) {
          const summary =
            failures.length &&
            failures
              .map((f) => `${f.provider}: ${f.detail}`)
              .join(" | ");

          return res.status(503).json({
            success: false,
            message: summary || "No image provider could generate an image.",
            hints: [
              "Default order uses Pollinations first (no separate API key). Opt out via ENABLE_POLLINATIONS_FALLBACK=false or IMAGE_GENERATION_PROVIDERS without pollinations.",
              "For best quality enable billing then use IMAGE_GENERATION_PROVIDERS=gemini,clipdrop,pollinations.",
              clipdropKey
                ? ""
                : "Optional: CLIPDROP_API_KEY adds Clipdrop alongside Gemini.",
            ].filter(Boolean),
          });
        }

        const mime = sniffImageMime(rawBuffer);
        const dataUri = `data:${mime};base64,${rawBuffer.toString("base64")}`;

        let secure_url;
        try {
          ({ secure_url } = await cloudinary.uploader.upload(dataUri, {
            resource_type: "image",
          }));
        } catch (cloudErr) {
          console.error("Cloudinary upload failed:", cloudErr?.message ?? cloudErr);
          return res.status(503).json({
            success: false,
            message:
              "Image was generated but could not be stored. Check CLOUDINARY_* keys in server/.env.",
          });
        }

        await insertCreation({
          userId,
          prompt,
          content: secure_url,
          type: "image",
          publish: publish ?? false,
        });

        res.json({ success: true, content: secure_url})
    } catch (error) {
        return handleAiError(res, error)
    }
}

export const removeImageBackground = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const image = req.file;

        if (!image) throw new Error('No image uploaded for background removal.')

        const {secure_url} = await cloudinary.uploader.upload(image.path, {
            transformation: [
                {
                    effect: 'background_removal',
                    background_removal: 'remove_the_background'
                }
            ],
            resource_type: 'image'
        })

        if (image.path) fs.unlinkSync(image.path)

        await insertCreation({ userId, prompt: 'Remove background from image', content: secure_url, type: 'image' })

        res.json({ success: true, content: secure_url })

    } catch (error) {
        return handleAiError(res, error)
    }
}

export const removeImageObject = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { object } = req.body;
        const image = req.file;

        if (!image) throw new Error('No image uploaded for object removal.')

        const {public_id} = await cloudinary.uploader.upload(image.path, { resource_type: 'image' })

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{ effect: `gen_remove:${object}` }],
            resource_type: 'image'
        })

        if (image.path) fs.unlinkSync(image.path)

        await insertCreation({ userId, prompt: `Removed ${object} from image`, content: imageUrl, type: 'image' })

        res.json({ success: true, content: imageUrl })

    } catch (error) {
        return handleAiError(res, error)
    }
}

export const resumeReview = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const resume = req.file;

        if (!resume) {
            return res.json({ success: false, message: 'No resume uploaded for review.' })
        }

        if(resume.size > 5 * 1024 * 1024){
            if (resume.path) fs.unlinkSync(resume.path)
            return res.json({success: false, message: "Resume file size exceeds allowed size (5MB)."})
        }

        const dataBuffer = fs.readFileSync(resume.path)
        const pdfData = await pdf(dataBuffer)

        if (resume.path) fs.unlinkSync(resume.path)

        const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses, and areas for improvement. Resume Content:\n\n${pdfData.text}`

       const response = await geminiChatCompletionsCreateWithFallback({
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const content = response?.choices?.[0]?.message?.content || response?.choices?.[0]?.text || ''

        await insertCreation({ userId, prompt: 'Review the uploaded resume', content, type: 'resume-review' })

        res.json({ success: true, content })

    } catch (error) {
        return handleAiError(res, error)
    }
}