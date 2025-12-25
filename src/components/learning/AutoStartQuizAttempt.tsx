"use client";

import { useEffect, useRef } from "react";

type Props = {
  slug: string;
  videoId: string | null;
  totalQuestions: number;
};

export default function AutoStartQuizAttempt({ slug, videoId, totalQuestions }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // リロードや開発モード二重発火の保険（任意）
    const key = `quizAttemptStarted:${slug}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch("/api/quiz-attempts/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, videoId, totalQuestions }),
    }).catch((e) => console.error("auto start failed", e));
  }, [slug, videoId, totalQuestions]);

  return null;
}
