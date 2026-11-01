export const QUESTION_LIMIT = 2000;
export const HISTORY_LIMIT = 12;
export const HISTORY_CHAR_LIMIT = 12000;
export const MESSAGE_LIMIT = 6000;
export type ChatMessage = { role: "user" | "assistant"; content: string };

export function recentHistory(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  let chars = 0;
  for (const message of messages.slice(-HISTORY_LIMIT).reverse()) {
    if (chars + message.content.length > HISTORY_CHAR_LIMIT) break;
    result.unshift(message);
    chars += message.content.length;
  }
  // Never start a truncated history with an orphaned answer.
  if (result[0]?.role === "assistant") result.shift();
  return result;
}

export function validateRequest(value: unknown): { videoId: string | null; question: string; history: ChatMessage[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid request");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["videoId", "question", "history"].includes(key))) throw new Error("Unexpected field");
  if (body.videoId !== null && (typeof body.videoId !== "string" || !/^[a-zA-Z0-9_-]{11}$/.test(body.videoId))) throw new Error("Invalid video ID");
  if (typeof body.question !== "string" || !body.question.trim() || body.question.length > QUESTION_LIMIT) throw new Error("Invalid question");
  if (!Array.isArray(body.history) || body.history.length > HISTORY_LIMIT || body.history.length % 2 !== 0) throw new Error("Invalid history");
  let chars = 0;
  const history = body.history.map((entry: unknown, index: number): ChatMessage => {
    if (!entry || typeof entry !== "object") throw new Error("Invalid message");
    const m = entry as Record<string, unknown>;
    if (Object.keys(m).some(key => !["role", "content"].includes(key)) || m.role !== (index % 2 === 0 ? "user" : "assistant") || typeof m.content !== "string" || !m.content.trim() || m.content.length > (m.role === "user" ? QUESTION_LIMIT : MESSAGE_LIMIT)) throw new Error("Invalid message");
    chars += m.content.length;
    return { role: index % 2 === 0 ? "user" : "assistant", content: m.content };
  });
  if (chars > HISTORY_CHAR_LIMIT) throw new Error("History too long");
  return { videoId: body.videoId as string | null, question: body.question.trim(), history };
}
