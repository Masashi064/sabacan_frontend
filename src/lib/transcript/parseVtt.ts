// Minimal WebVTT -> readable-paragraphs parser.
//
// YouTube auto-captions are often exported as "rolling" cues: each cue
// repeats the previous cue's line(s) plus one new line (a 2-3 line
// scrolling window), e.g.
//   cue1: ["The spell of extreme heat", "this month has"]
//   cue2: ["this month has", "seen the UK record"]
// Naively concatenating every cue's text triples/quadruples most of the
// transcript. We dedupe by skipping any line that's already in a small
// recent-lines window before flattening to words and re-chunking into
// paragraphs.
const DEDUPE_WINDOW = 6;

function cleanLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, "") // inline tags, e.g. "<00:00:01.000><c>word</c>"
    .replace(/&gt;&gt;/g, "") // ">>" speaker-change marker, HTML-escaped
    .replace(/>>/g, "") // ">>" speaker-change marker, literal
    .trim();
}

function isMetaLine(line: string): boolean {
  return (
    line === "" ||
    line === "WEBVTT" ||
    /^\d+$/.test(line) || // cue index
    line.includes("-->") || // timestamp line
    /^(NOTE|STYLE|REGION|Kind:|Language:)/i.test(line)
  );
}

export function parseVttToParagraphs(vtt: string, wordsPerParagraph = 40): string[] {
  const rawLines = vtt.split(/\r?\n/);

  const recentLines: string[] = [];
  const dedupedLines: string[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (isMetaLine(trimmed)) continue;

    const cleaned = cleanLine(trimmed);
    if (!cleaned) continue;

    if (recentLines.includes(cleaned)) continue;

    dedupedLines.push(cleaned);
    recentLines.push(cleaned);
    if (recentLines.length > DEDUPE_WINDOW) recentLines.shift();
  }

  const words = dedupedLines.join(" ").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const paragraphs: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerParagraph) {
    paragraphs.push(words.slice(i, i + wordsPerParagraph).join(" "));
  }
  return paragraphs;
}

// Best-effort fallback for transcript_json when vtt_text isn't
// available. Shape isn't guaranteed, so this only handles the common
// cases (array of cue objects with a text-like field, or a plain
// string) and otherwise returns an empty list rather than guessing.
export function parseTranscriptJsonToParagraphs(
  data: unknown,
  wordsPerParagraph = 40
): string[] {
  let text = "";

  if (typeof data === "string") {
    text = data;
  } else if (Array.isArray(data)) {
    text = data
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const candidate = obj.text ?? obj.caption ?? obj.content;
          return typeof candidate === "string" ? candidate : "";
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const words = cleaned.split(" ");
  const paragraphs: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerParagraph) {
    paragraphs.push(words.slice(i, i + wordsPerParagraph).join(" "));
  }
  return paragraphs;
}
