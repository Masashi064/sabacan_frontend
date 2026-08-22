"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { gaEvent } from "@/lib/ga";
import { useAchievements } from "@/lib/achievements/AchievementProvider";

export type QuizQuestion = {
  question: string;
  choices: string[];
  answer: string;
  explanation?: string;
};

const STUDY_CAP_SECONDS = 45 * 60; // 2700 (safety cap)

async function computeStudySeconds({
  supabase,
  slug,
  fallbackQuizSeconds,
}: {
  supabase: any;
  slug: string;
  fallbackQuizSeconds: number;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fallbackQuizSeconds;

  const { data, error } = await supabase
    .from("learning_events")
    .select("occurred_at")
    .eq("user_id", user.id)
    .eq("slug", slug)
    .eq("event_type", "video_start")
    .order("occurred_at", { ascending: false })
    .limit(1);

  if (error) return fallbackQuizSeconds;

  const startedAt = data?.[0]?.occurred_at ? new Date(data[0].occurred_at) : null;
  if (!startedAt) return fallbackQuizSeconds;

  const now = new Date();
  const diffSec = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

  if (!Number.isFinite(diffSec) || diffSec <= 0) return fallbackQuizSeconds;

  return Math.min(diffSec, STUDY_CAP_SECONDS);
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function QuizSection({
  quiz,
  slug,
  videoId,
  onProgressChange,
}: {
  quiz: QuizQuestion[];
  slug: string;
  videoId: string | null;
  onProgressChange?: (current: number, total: number) => void;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const { notifyAchievements } = useAchievements();
  const [selected, setSelected] = React.useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // progress
  const answeredCount = Object.keys(selected).length;
  const correctCount = quiz.reduce((acc, q, i) => {
    const s = selected[i];
    return acc + (s && s === q.answer ? 1 : 0);
  }, 0);

  const showResults = quiz.length > 0 && currentIndex >= quiz.length;

  React.useEffect(() => {
    if (quiz.length === 0) return;
    onProgressChange?.(Math.min(currentIndex + 1, quiz.length), quiz.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, quiz.length]);

  // fallback: first answer -> finished
  const firstAnswerAtMsRef = React.useRef<number | null>(null);
  const submittedRef = React.useRef(false);
  const achievementCheckedRef = React.useRef(false);
  const quizCompleteSentRef = React.useRef(false);
  function goTo(idx: number) {
    setCurrentIndex(Math.max(0, Math.min(idx, quiz.length)));
  }

  const [saveStatus, setSaveStatus] = React.useState<
    "idle" | "saving" | "saved" | "error" | "skipped"
  >("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function saveAttemptOnce() {
    if (submittedRef.current) return;
    submittedRef.current = true;

    // If not logged in, skip saving
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      setSaveStatus("skipped");
      return;
    }

    const completedAt = new Date();

    // Fallback seconds = first answer -> complete
    const fallbackStartedMs = firstAnswerAtMsRef.current ?? Date.now();
    const fallbackSeconds = Math.max(
      0,
      Math.round((Date.now() - fallbackStartedMs) / 1000)
    );

    // ✅ Main: video_start -> complete (with cap), fallback if not found
    const durationSeconds = await computeStudySeconds({
      supabase,
      slug,
      fallbackQuizSeconds: fallbackSeconds,
    });

    setSaveStatus("saving");
    setSaveError(null);

    const { error } = await supabase.from("quiz_attempts").insert({
      user_id: userRes.user.id,
      slug,
      video_id: videoId,
      total_questions: quiz.length,
      correct_count: correctCount,
      started_at: new Date(fallbackStartedMs).toISOString(), // (optional) first-answer time as metadata
      completed_at: completedAt.toISOString(),
      duration_seconds: durationSeconds, // ✅ learning time definition
    });

    if (error) {
      setSaveStatus("error");
      setSaveError(error.message);
      return;
    }

    setSaveStatus("saved");

    // Check achievements after quiz_attempt is persisted
    void checkAchievementsOnce();
  }

  async function checkAchievementsOnce() {
    if (achievementCheckedRef.current) return;
    achievementCheckedRef.current = true;

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return;

    const { data, error } = await supabase.rpc("check_and_unlock_achievements", {
      p_slug: slug,
    });

    if (error) {
      console.error("[achievements] check failed:", error.message);
      return;
    }

    const unlocks = Array.isArray(data) ? data : [];
    if (unlocks.length > 0) {
      notifyAchievements(unlocks);
    }
  }

  // Save the moment all questions are answered
  React.useEffect(() => {
    if (quiz.length === 0) return;
    if (answeredCount !== quiz.length) return;
    if (!quizCompleteSentRef.current) {
      quizCompleteSentRef.current = true;
      gaEvent("quiz_complete", { slug });
    }

    void saveAttemptOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, quiz.length]);

  function handleChoice(idx: number, choice: string) {
    if (typeof selected[idx] === "string") return; // lock after first pick

    // fallback timer start (first answer)
    if (firstAnswerAtMsRef.current === null) {
      firstAnswerAtMsRef.current = Date.now();
    }

    setSelected((prev) => ({ ...prev, [idx]: choice }));
  }

  function firstUnansweredIndex() {
    for (let i = 0; i < quiz.length; i++) {
      if (typeof selected[i] !== "string") return i;
    }
    return null;
  }

  if (quiz.length === 0) return null;

  return (
    <section className="space-y-4">
      {!showResults && saveStatus === "error" ? (
        <p className="text-xs text-red-600" title={saveError ?? undefined}>
          Save failed{saveError ? `: ${saveError}` : ""}
        </p>
      ) : null}

      {!showResults ? (
        (() => {
          const idx = currentIndex;
          const q = quiz[idx];
          const picked = selected[idx];
          const isAnswered = typeof picked === "string";
          const isCorrect = isAnswered && picked === q.answer;
          const isLast = idx === quiz.length - 1;

          return (
            <div key={idx} className="flex flex-col h-[26rem]">
              <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                <div className="space-y-1">
                  <p className="text-base font-medium">
                    Q{idx + 1}. {q.question}
                  </p>
                </div>

                <div className="grid gap-2">
                  {q.choices.map((choice) => {
                    const chosen = picked === choice;
                    const correct = q.answer === choice;

                    const base =
                      "w-full text-left rounded-md border px-3 py-2 text-sm transition-colors";
                    const state = !isAnswered
                      ? "hover:bg-muted"
                      : chosen && correct
                      ? "border-emerald-500 bg-emerald-50"
                      : chosen && !correct
                      ? "border-red-500 bg-red-50"
                      : correct
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "opacity-70";

                    return (
                      <button
                        key={choice}
                        type="button"
                        className={cn(base, state)}
                        onClick={() => handleChoice(idx, choice)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span>{choice}</span>
                          {isAnswered && correct ? (
                            <span className="text-emerald-700 font-medium">Answer</span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isAnswered ? (
                  isCorrect ? (
                    <p className="text-sm font-medium text-emerald-700">Correct ✅</p>
                  ) : (
                    <p className="text-sm font-medium text-red-700">Incorrect ❌</p>
                  )
                ) : null}

                {isAnswered ? (
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Correct answer:</span> {q.answer}
                    </p>
                    {q.explanation ? (
                      <p className="text-sm text-muted-foreground">{q.explanation}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 mt-1 border-t shrink-0">
                <Button variant="outline" onClick={() => goTo(idx - 1)} disabled={idx === 0}>
                  Back
                </Button>
                <Button onClick={() => goTo(idx + 1)}>{isLast ? "See results" : "Next"}</Button>
              </div>
            </div>
          );
        })()
      ) : answeredCount < quiz.length ? (
        <div className="space-y-3">
          <p className="text-base font-medium">Quiz not finished</p>
          <p className="text-sm text-muted-foreground">
            Answer all {quiz.length} questions to see your results.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              const idx = firstUnansweredIndex();
              if (idx !== null) goTo(idx);
            }}
          >
            Go to unanswered question
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-base font-medium">
            {correctCount} / {quiz.length} Correct!
          </p>
        </div>
      )}
    </section>
  );
}
