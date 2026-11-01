import type { Metadata } from "next";
import type { ArticleData } from "./getArticleData";

const SITE_URL = "https://sabacan365.com";
const clean = (value: string | null) => value?.replace(/\s+/g, " ").trim() ?? "";

export function buildArticleMetadata({ category, quizList, vocabItems, transcriptParagraphs }: ArticleData): Metadata {
  const videoTitle = clean(category.video_title) || category.slug;
  const title = `${videoTitle} | English Listening Practice | Sabacan365`;
  const canonical = `${SITE_URL}/articles/${encodeURIComponent(category.slug)}`;
  const channel = clean(category.channel_name);
  const details = [clean(category.assigned_category), clean(category.assigned_level)].filter(Boolean);
  const activities = [quizList.length ? "quiz" : null, vocabItems.length ? "vocabulary" : null,
    transcriptParagraphs.length ? "transcript" : null].filter(Boolean);
  const description = [
    `Practice English listening with "${videoTitle}"${channel ? ` from ${channel}` : ""}.`,
    details.length ? `${details.join(" / ")}.` : "",
    activities.length ? `Includes ${activities.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
  let image = `${SITE_URL}/toppage.png`;
  try {
    const thumbnail = new URL(category.thumbnail_url ?? "");
    if (thumbnail.protocol === "https:" || thumbnail.protocol === "http:") image = thumbnail.href;
  } catch { /* Use the existing site image when a thumbnail is missing or invalid. */ }
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title, description, url: canonical, siteName: "Sabacan365", type: "website", locale: "en_US",
      images: [{ url: image, alt: videoTitle }],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}
