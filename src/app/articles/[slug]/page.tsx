import StudyStartMarker from "@/components/learning/StudyStartMarker";
import { supabaseServer } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizSection, type QuizQuestion } from "@/components/quiz/QuizSection";
import { VocabularySection, type VocabItem } from "@/components/vocab/VocabularySection";

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

  const leadIntro: string | null = q?.quiz_json?.lead_intro ?? null;

  const quizList: QuizQuestion[] = Array.isArray(q?.quiz_json?.quiz)
    ? q!.quiz_json.quiz
    : [];

  const vocabItems: VocabItem[] = Array.isArray(v?.vocab_json?.vocabulary)
    ? v!.vocab_json.vocabulary
    : [];

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-8">
      {/* ✅ ここで「記事ページに入った瞬間に計測開始」 */}
      <StudyStartMarker slug={slug} />

      <a href="/" className="text-sm underline">
        ← Back
      </a>

      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{c.video_title ?? c.slug}</h1>
        <p className="text-sm text-muted-foreground">
          {c.channel_name ?? "Unknown channel"}
          {c.published_date ? ` • ${c.published_date}` : ""}
          {c.video_length ? ` • ${c.video_length}` : ""}
          {c.assigned_level ? ` • ${c.assigned_level}` : ""}
          {c.assigned_category ? ` • ${c.assigned_category}` : ""}
        </p>
      </header>

      {/* Lead */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Lead</h2>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm leading-relaxed">
              {leadIntro ?? "Lead intro is not available yet."}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* YouTube */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Video</h2>

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
      </section>

      {/* Quiz */}
      <section>
        {quizList.length > 0 ? (
          <QuizSection quiz={quizList} slug={slug} videoId={c.video_id ?? null} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quiz</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Quiz data is not available yet for this article.
            </CardContent>
          </Card>
        )}
      </section>

      {/* Vocabulary */}
      <section>
        {vocabItems.length > 0 ? (
          <VocabularySection items={vocabItems} slug={slug} videoId={c.video_id ?? null} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vocabulary</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Vocabulary data is not available yet for this article.
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
