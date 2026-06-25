import StudyStartMarker from "@/components/learning/StudyStartMarker";
import { supabaseServer } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizCard } from "@/components/quiz/QuizCard";
import type { QuizQuestion } from "@/components/quiz/QuizSection";
import { VocabularySection, type VocabItem } from "@/components/vocab/VocabularySection";
import { ReportIssueButton } from "@/components/article/ReportIssueButton";
import { LearningSection } from "@/components/article/LearningSection";
import { formatVideoLength } from "@/lib/utils";
import {
  parseTranscriptJsonToParagraphs,
  parseVttToParagraphs,
} from "@/lib/transcript/parseVtt";

export const dynamic = "force-dynamic";

type CategoryRow = {
  slug: string;
  video_id: string | null;
  assigned_category: string | null;
  assigned_level: string | null;
  published_date: string | null;
  thumbnail_url: string | null;
  channel_name: string | null;
  video_title: string | null;
  video_length: string | null;
};

type QuizRow = {
  video_id: string;
  slug: string;
  quiz_json: any;
};

type VocabRow = {
  id: number;
  video_id: string;
  slug: string;
  vocab_json: any | null;
};

type CaptionsRow = {
  video_id: string | null;
  slug: string;
  vtt_text: string | null;
  transcript_json: unknown;
};

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const supabase = await supabaseServer();

  // ✅ Next.js 16: params は Promise
  const { slug } = await params;

  // ✅ categories + quiz + vocab を並列取得
  const [
    { data: category, error: catErr },
    { data: quizRow, error: quizErr },
    { data: vocabRow, error: vocabErr },
    captionsRes,
  ] = await Promise.all([
    supabase.from("categories").select("*").eq("slug", slug).maybeSingle(),
    supabase.from("quiz").select("*").eq("slug", slug).maybeSingle(),
    supabase
      .from("vocab")
      .select("*")
      .eq("slug", slug)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Transcript is a nice-to-have enhancement — never let a missing
    // table/row break the rest of the page.
    supabase
      .from("captions")
      .select("video_id,slug,vtt_text,transcript_json")
      .eq("slug", slug)
      .maybeSingle()
      .then(
        (res) => res,
        () => ({ data: null, error: null })
      ),
  ]);

  if (catErr || quizErr || vocabErr) {
    return (
      <main className="mx-auto max-w-4xl p-6 space-y-4">
        <a href="/" className="text-sm underline">
          ← Back
        </a>
        <Card>
          <CardHeader>
            <CardTitle>Fetch error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm overflow-auto">
              {JSON.stringify({ catErr, quizErr, vocabErr }, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </main>
    );
  }

  const c = category as CategoryRow | null;
  const q = quizRow as QuizRow | null;
  const v = vocabRow as VocabRow | null;
  const captions = (captionsRes?.data ?? null) as CaptionsRow | null;

  if (!c) {
    return (
      <main className="mx-auto max-w-4xl p-6 space-y-4">
        <a href="/" className="text-sm underline">
          ← Back
        </a>
        <Card>
          <CardHeader>
            <CardTitle>Not found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No category row found for slug: <code>{slug}</code>
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Note: lead_intro (formerly shown here as "Summary") is intentionally
  // not rendered on this page anymore — after watching the video and
  // taking the quiz, a pre-video synopsis adds little value. The data
  // is kept for use as "description text" elsewhere (recommendation
  // cards, article list, search results), just not surfaced here.

  const quizList: QuizQuestion[] = Array.isArray(q?.quiz_json?.quiz)
    ? q!.quiz_json.quiz
    : [];

  const vocabItems: VocabItem[] = Array.isArray(v?.vocab_json?.vocabulary)
    ? v!.vocab_json.vocabulary
    : [];

  // Prefer vtt_text (raw WebVTT) when present; fall back to
  // transcript_json's best-effort shape only when there's no vtt_text.
  const transcriptParagraphs: string[] = captions?.vtt_text
    ? parseVttToParagraphs(captions.vtt_text)
    : captions?.transcript_json
    ? parseTranscriptJsonToParagraphs(captions.transcript_json)
    : [];

  const metaLine = [
    c.channel_name ?? "Unknown channel",
    formatVideoLength(c.video_length),
    c.assigned_level,
    c.assigned_category,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      {/* ✅ ここで「記事ページに入った瞬間に計測開始」 */}
      <StudyStartMarker slug={slug} />

      <a href="/" className="text-sm underline">
        ← Back
      </a>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{c.video_title ?? c.slug}</h1>
        {metaLine ? <p className="text-xs text-muted-foreground">{metaLine}</p> : null}
      </header>

      {/* YouTube */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted">
        {c.video_id ? (
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${c.video_id}`}
            title={c.video_title ?? "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
            video_id is missing
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* Quiz */}
        <QuizCard quiz={quizList} slug={slug} videoId={c.video_id ?? null} />

        {/* Vocabulary */}
        <LearningSection
          icon="🧩"
          title="Vocabulary"
          meta={
            vocabItems.length > 0
              ? `${vocabItems.length} word${vocabItems.length === 1 ? "" : "s"} to learn`
              : undefined
          }
          description="Tap to flip cards and save favorites."
          collapsible
          showLabel="Show vocabulary"
          hideLabel="Hide vocabulary"
        >
          {vocabItems.length > 0 ? (
            <VocabularySection items={vocabItems} slug={slug} videoId={c.video_id ?? null} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Vocabulary data is not available yet for this article.
            </p>
          )}
        </LearningSection>

        {/* Transcript */}
        <LearningSection
          icon="💬"
          title="Transcript"
          description="Read along with the video."
          collapsible
          showLabel="Show transcript"
          hideLabel="Hide transcript"
        >
          {transcriptParagraphs.length > 0 ? (
            <div className="space-y-3">
              {transcriptParagraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Transcript is not available yet for this article.
            </p>
          )}
        </LearningSection>

        {/* Found a problem? */}
        <LearningSection
          icon="⚠️"
          title="Found a problem?"
          description="Help us improve this article."
          collapsible
          showLabel="Report an issue"
          hideLabel="Close"
        >
          <ReportIssueButton slug={slug} videoId={c.video_id ?? null} />
        </LearningSection>
      </div>
    </main>
  );
}
