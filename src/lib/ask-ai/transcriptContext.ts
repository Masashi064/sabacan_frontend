import type { ChatMessage } from "./shared";

const CONTEXT_LIMIT = 6000;
const CHUNK_SIZE = 900;
const CHUNK_STEP = 750;
const CHUNK_LIMIT = 6;
const STOP_WORDS = new Set("a an the is are was were be been to of in on at for from with and or it this that what why how does do did can could would should please explain mean meaning video another example give me".split(" "));

// Retrieval is local: no extra model calls, embeddings, or transcript storage.
export function selectTranscriptContext(paragraphs: string[], question: string, history: ChatMessage[]) {
  const text = paragraphs.join("\n").trim();
  if (!text) return { transcriptExcerpt: null, transcriptMayBePartial: false, transcriptCharacters: 0 };
  if (text.length <= CONTEXT_LIMIT) return { transcriptExcerpt: text, transcriptMayBePartial: false, transcriptCharacters: text.length };

  const terms = (value: string) => [...new Set((value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter(term => term.length > 1 && !STOP_WORDS.has(term)))].slice(0, 32);
  const currentTerms = terms(question);
  const previousTerms = terms(history.filter(message => message.role === "user").slice(-2).map(message => message.content).join(" "));
  const chunks: { start: number; end: number; score: number }[] = [];
  for (let start = 0; start < text.length; start += CHUNK_STEP) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const content = text.slice(start, end).toLowerCase();
    const score = currentTerms.reduce((sum, term) => sum + (content.includes(term) ? 3 : 0), 0)
      + previousTerms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0);
    chunks.push({ start, end, score });
    if (end === text.length) break;
  }
  // Always keep introductory context; prioritize matches from the current question
  // and recent follow-ups. With no lexical matches, sample across the whole video.
  const selected = new Set([0]);
  const ranked = chunks.map((chunk, index) => ({ ...chunk, index })).filter(chunk => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);
  for (const chunk of ranked) {
    if (selected.size === CHUNK_LIMIT) break;
    selected.add(chunk.index);
  }
  for (let slot = 1; slot < CHUNK_LIMIT && selected.size < CHUNK_LIMIT; slot++) {
    selected.add(Math.round(slot * (chunks.length - 1) / (CHUNK_LIMIT - 1)));
  }
  const excerpt = [...selected].sort((a, b) => a - b).map(index => {
    const chunk = chunks[index];
    return `[Transcript characters ${chunk.start + 1}-${chunk.end}]\n${text.slice(chunk.start, chunk.end)}`;
  }).join("\n\n[... excerpt gap ...]\n\n").slice(0, CONTEXT_LIMIT);
  return { transcriptExcerpt: excerpt, transcriptMayBePartial: true, transcriptCharacters: text.length };
}
