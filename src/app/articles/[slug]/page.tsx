import Link from "next/link";
import StudyStartMarker from "@/components/learning/StudyStartMarker";
import { LearningTabs } from "@/components/article/LearningTabs";
import { ReportIssueSection } from "@/components/article/ReportIssueSection";
import { formatVideoLength } from "@/lib/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getArticleData } from "@/lib/articles/getArticleData";
import { buildArticleMetadata } from "@/lib/articles/metadata";

export const dynamic = "force-dynamic";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  let article;
  try {
    article = await getArticleData(slug);
  } catch {
    // The page throws separately so an upstream failure is never treated as 404.
    return { title: "Video unavailable | Sabacan365", robots: { index: false, follow: false } };
  }
  if (!article) notFound();
  return buildArticleMetadata(article);
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleData(slug);
  if (!article) notFound();
  const { category: c, quizList, vocabItems, transcriptParagraphs } = article;

  const metaLine = [
    c.channel_name ?? "Unknown channel",
    c.published_date ? `Published: ${c.published_date}` : null,
    formatVideoLength(c.video_length),
    c.assigned_level,
    c.assigned_category,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <main className="article-study-page mx-auto max-w-4xl p-6 space-y-6">
      {/* ✅ ここで「記事ページに入った瞬間に計測開始」 */}
      <StudyStartMarker slug={slug} />

      <Link href="/" className="text-sm underline">
        ← Back
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{c.video_title ?? c.slug}</h1>
        {metaLine ? <p className="text-xs text-muted-foreground">{metaLine}</p> : null}
      </header>

      <div className="article-learning-layout">
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

        <div className="article-learning-panel">
          <LearningTabs
            quiz={quizList}
            slug={slug}
            videoId={c.video_id ?? null}
            vocabItems={vocabItems}
            transcriptParagraphs={transcriptParagraphs}
          />
        </div>
      </div>

      {/* Found a problem?: a low-emphasis secondary action, not part of
          the main learning flow — stays separate from the learning tabs. */}
      <ReportIssueSection slug={slug} videoId={c.video_id ?? null} />
    </main>
  );
}
