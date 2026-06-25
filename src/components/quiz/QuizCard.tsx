"use client";

import * as React from "react";

import { LearningSection } from "@/components/article/LearningSection";
import { QuizSection, type QuizQuestion } from "@/components/quiz/QuizSection";

// Owns the lifted "current question / total" state so it can show in the
// LearningSection header ("🧠 Quiz  1 / 5") instead of as a separate line
// above the question — the goal is for the question to be the first thing
// visible right after the header, no extra text in between.
export function QuizCard({
  quiz,
  slug,
  videoId,
}: {
  quiz: QuizQuestion[];
  slug: string;
  videoId: string | null;
}) {
  const [progress, setProgress] = React.useState<{ current: number; total: number } | null>(
    null
  );

  return (
    <LearningSection
      icon="🧠"
      title="Quiz"
      titleRight={progress ? `${progress.current} / ${progress.total}` : undefined}
    >
      {quiz.length > 0 ? (
        <QuizSection
          quiz={quiz}
          slug={slug}
          videoId={videoId}
          onProgressChange={(current, total) => setProgress({ current, total })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Quiz data is not available yet for this article.
        </p>
      )}
    </LearningSection>
  );
}
