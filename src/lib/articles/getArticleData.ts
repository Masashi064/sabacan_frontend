import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import type { QuizQuestion } from "@/components/quiz/QuizSection";
import type { VocabItem } from "@/components/vocab/VocabularySection";
import { parseTranscriptJsonToParagraphs, parseVttToParagraphs } from "@/lib/transcript/parseVtt";

export type ArticleCategory = {
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

export type ArticleData = {
  category: ArticleCategory;
  quizList: QuizQuestion[];
  vocabItems: VocabItem[];
  transcriptParagraphs: string[];
};

// React cache deduplicates metadata/page reads inside one server render only.
// No shared data cache, user history lookup, service-role client, or RLS bypass.
export const getArticleData = cache(async (slug: string): Promise<ArticleData | null> => {
  try {
    const supabase = await supabaseServer();
    const [categoryRes, quizRes, vocabRes, captionsRes] = await Promise.all([
      supabase.from("categories")
        .select("slug,video_id,assigned_category,assigned_level,published_date,thumbnail_url,channel_name,video_title,video_length")
        .eq("slug", slug).maybeSingle(),
      supabase.from("quiz").select("video_id,slug,quiz_json").eq("slug", slug).maybeSingle(),
      supabase.from("vocab").select("id,video_id,slug,vocab_json").eq("slug", slug)
        .order("id", { ascending: false }).limit(1).maybeSingle(),
      // Preserve the existing optional-caption behavior.
      supabase.from("captions").select("video_id,slug,vtt_text,transcript_json")
        .eq("slug", slug).maybeSingle().then(res => res, () => ({ data: null, error: null })),
    ]);
    if (categoryRes.error) throw new Error("Video lookup failed");
    if (!categoryRes.data) return null;
    if (quizRes.error || vocabRes.error) throw new Error("Learning content lookup failed");
    const quizJson = quizRes.data?.quiz_json as { quiz?: QuizQuestion[] } | null;
    const vocabJson = vocabRes.data?.vocab_json as { vocabulary?: VocabItem[] } | null;
    const captions = captionsRes.data;
    return {
      category: categoryRes.data as ArticleCategory,
      quizList: Array.isArray(quizJson?.quiz) ? quizJson.quiz : [],
      vocabItems: Array.isArray(vocabJson?.vocabulary) ? vocabJson.vocabulary : [],
      transcriptParagraphs: captions?.vtt_text ? parseVttToParagraphs(captions.vtt_text)
        : captions?.transcript_json ? parseTranscriptJsonToParagraphs(captions.transcript_json) : [],
    };
  } catch {
    // Never serialize Supabase messages/details, query URLs, or credentials.
    throw new Error("Unable to load this video. Please try again later.");
  }
});
