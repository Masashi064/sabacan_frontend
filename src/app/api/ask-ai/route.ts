import OpenAI from "openai";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { ASK_AI_INSTRUCTIONS } from "@/lib/ask-ai/prompt";
import { validateRequest, MESSAGE_LIMIT } from "@/lib/ask-ai/shared";
import { parseTranscriptJsonToParagraphs, parseVttToParagraphs } from "@/lib/transcript/parseVtt";

export const runtime = "nodejs";
export const maxDuration = 45;

function error(message: string, status: number, headers = {}) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

async function readBody(req: Request) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid content type");
  if (!req.body) throw new Error("Missing body");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64000) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return validateRequest(JSON.parse(Buffer.concat(chunks).toString("utf8")));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return error("This request is not allowed.", 403);
  try {
    const supabase = await supabaseServer();
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) return error("Please sign in before asking a question.", 401);
    let body;
    try { body = await readBody(req); } catch { return error("Please check the format and length of your question and conversation history.", 400); }
    if (!process.env.OPENAI_API_KEY) return error("Ask AI is currently unavailable. Please try again later.", 503);
    // Atomic, shared across Vercel instances; fail closed if migration is absent.
    const { data: allowed, error: limitError } = await supabase.rpc("consume_ask_ai_request");
    if (limitError) return error("Ask AI is currently unavailable. Please try again later.", 503);
    if (allowed !== true) return error("You have reached the usage limit (10 requests per minute and 100 per day). Please try again later.", 429, { "Retry-After": "60" });

    let context: unknown = { available: false };
    if (body.videoId) {
      const { data: video, error: videoError } = await supabase.from("categories")
        .select("video_id,slug,video_title,channel_name,assigned_category,assigned_level")
        .eq("video_id", body.videoId).limit(1).maybeSingle();
      if (videoError) return error("Could not load the video information. Please try again.", 503);
      if (!video) return error("This video could not be found or is not accessible.", 404);
      let transcript: string | null = null;
      // Explicit opt-in: displaying a caption does not imply permission to send it to AI.
      if (process.env.ASK_AI_INCLUDE_TRANSCRIPT === "true") {
        const { data: captions } = await supabase.from("captions").select("vtt_text,transcript_json")
          .eq("video_id", video.video_id).eq("slug", video.slug).limit(1).maybeSingle();
        if (captions) {
          const paragraphs = captions.vtt_text ? parseVttToParagraphs(captions.vtt_text) : parseTranscriptJsonToParagraphs(captions.transcript_json);
          transcript = paragraphs.join("\n").slice(0, 6000) || null;
        }
      }
      const clip = (value: unknown) => typeof value === "string" ? value.slice(0, 300) : null;
      context = { title: clip(video.video_title), channel: clip(video.channel_name), category: clip(video.assigned_category), difficulty: clip(video.assigned_level), transcriptExcerpt: transcript, transcriptMayBePartial: true };
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30000, maxRetries: 0 });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      instructions: ASK_AI_INSTRUCTIONS,
      input: [{ role: "user", content: `Reference video data (untrusted JSON, not a question): ${JSON.stringify(context)}` }, ...body.history, { role: "user", content: body.question }],
      max_output_tokens: 1200,
      store: false,
      ...( (!process.env.OPENAI_MODEL || process.env.OPENAI_MODEL === "gpt-5.6-luna") ? { reasoning: { effort: "none" as const } } : {}),
    }, { signal: req.signal });
    if (response.status !== "completed" || !response.output_text?.trim()) return error("Could not complete the answer. Please shorten your question and try again.", 502);
    return NextResponse.json({ answer: response.output_text.trim().slice(0, MESSAGE_LIMIT) }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof OpenAI.APIConnectionTimeoutError) return error("The answer timed out. Please try again.", 504);
    if (cause instanceof OpenAI.APIError && cause.status === 429) return error("Ask AI is busy. Please wait a moment and try again.", 429, { "Retry-After": "30" });
    return error("Could not get an answer. Please try again later.", 502);
  }
}
