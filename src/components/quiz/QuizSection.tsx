"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { supabaseBrowser } from "@/lib/supabase/client";
import { gaEvent } from "@/lib/ga";
import { useCoins } from "@/lib/coins/CoinProvider";

export type QuizQuestion = {
  question: string;
  choices: string[];
  answer: string;
  explanation?: string;
};

type CoinResult = {
  awarded: number;
  isFirst: boolean;
  bonus: number;
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
}: {
  quiz: QuizQuestion[];
  slug: string;
  videoId: string | null;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const { notifyReward, refreshBalance } = useCoins();
  const [selected, setSelected] = React.useState<Record<number, string>>({});
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // progress
  const answeredCount = Object.keys(selected).length;
  const correctCount = quiz.reduce((acc, q, i) => {
    const s = selected[i];
    return acc + (s && s === q.answer ? 1 : 0);
  }, 0);

  const showResults = quiz.length > 0 && currentIndex >= quiz.length;

  // fallback: first answer -> finished
  const firstAnswerAtMsRef = React.useRef<number | null>(null);
  const submittedRef = React.useRef(false);
  const coinAwardSubmittedRef = React.useRef(false);
  const bonusToastSentRef = React.useRef(false);
  const quizCompleteSentRef = React.useRef(false);
  const autoAdvanceTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
    };
  }, []);

  function goTo(idx: number) {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setCurrentIndex(Math.max(0, Math.min(idx, quiz.length)));
  }

  const [saveStatus, setSaveStatus] = React.useState<
    "idle" | "saving" | "saved" | "error" | "skipped"
  >("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const [coinAwardStatus, setCoinAwardStatus] = React.useState<
    "idle" | "awarding" | "awarded" | "skipped" | "error"
  >("idle");
  const [coinResult, setCoinResult] = React.useState<CoinResult | null>(null);

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
  }

  async function awardCoinsOnce() {
    if (coinAwardSubmittedRef.current) return;
    coinAwardSubmittedRef.current = true;

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      setCoinAwardStatus("skipped");
      return;
    }

    setCoinAwardStatus("awarding");

    const { data, error } = await supabase.rpc("award_quiz_coins", {
      p_slug: slug,
      p_correct_count: correctCount,
      p_total_questions: quiz.length,
    });

    if (error) {
      setCoinAwardStatus("error");
      return;
    }

    setCoinResult({
      awarded: data.awarded,
      isFirst: data.is_first_completion,
      bonus: data.bonus_amount,
    });
    setCoinAwardStatus("awarded");
    void refreshBalance();
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
    void awardCoinsOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, quiz.length]);

  // Bonus toast, once, when the results screen reveals a perfect first attempt
  React.useEffect(() => {
    if (!showResults) return;
    if (bonusToastSentRef.current) return;
    if (coinAwardStatus !== "awarded" || !coinResult) return;
    if (coinResult.isFirst && coinResult.bonus > 0) {
      bonusToastSentRef.current = true;
      notifyReward({ amount: coinResult.bonus, label: "+30 Bonus!" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResults, coinAwardStatus, coinResult]);

  function handleChoice(idx: number, choice: string) {
    if (typeof selected[idx] === "string") return; // lock after first pick

    // fallback timer start (first answer)
    if (firstAnswerAtMsRef.current === null) {
      firstAnswerAtMsRef.current = Date.now();
    }

    setSelected((prev) => ({ ...prev, [idx]: choice }));

    if (choice === quiz[idx]?.answer) {
      notifyReward({ amount: 10, label: "+10 Coins" });

      // Correct answer: auto-advance to the next question shortly after.
      if (autoAdvanceTimeoutRef.current) clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = setTimeout(() => {
        autoAdvanceTimeoutRef.current = null;
        setCurrentIndex((i) => (i === idx ? idx + 1 : i));
      }, 900);
    }
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
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          {!showResults ? (
            <p className="text-sm text-muted-foreground">
              Question {Math.min(currentIndex + 1, quiz.length)} of {quiz.length}
            </p>
          ) : null}
        </div>

        {!showResults ? (
          <div className="text-xs text-muted-foreground text-right">
            {saveStatus === "idle" ? null : saveStatus === "saving" ? (
              <span>Saving…</span>
            ) : saveStatus === "saved" ? (
              <span>Saved ✅</span>
            ) : saveStatus === "skipped" ? (
              <span>Login to save progress</span>
            ) : (
              <span className="text-red-600">Save failed</span>
            )}
            {saveStatus === "error" && saveError ? (
              <div className="mt-1 max-w-[320px] truncate" title={saveError}>
                {saveError}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!showResults ? (
        (() => {
          const idx = currentIndex;
          const q = quiz[idx];
          const picked = selected[idx];
          const isAnswered = typeof picked === "string";
          const isCorrect = isAnswered && picked === q.answer;
          const isLast = idx === quiz.length - 1;

          return (
            <div key={idx} className="space-y-3">
              <div className="space-y-1">
                <p className="text-base font-medium">
                  Q{idx + 1}. {q.question}
                </p>

                {!isAnswered ? (
                  <p className="text-sm text-muted-foreground">Choose an answer.</p>
                ) : isCorrect ? (
                  <p className="text-sm font-medium text-emerald-700">Correct ✅</p>
                ) : (
                  <p className="text-sm font-medium text-red-700">Incorrect ❌</p>
                )}
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
                <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Correct answer:</span> {q.answer}
                  </p>
                  {q.explanation ? (
                    <p className="text-sm text-muted-foreground">{q.explanation}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 pt-1">
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
            Answer all {quiz.length} questions to see your results and earn coins.
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
          {coinAwardStatus === "skipped" ? (
            <p className="text-sm text-muted-foreground">
              Login to earn coins for completing quizzes.
            </p>
          ) : coinAwardStatus === "error" ? (
            <p className="text-sm text-muted-foreground">Coins could not be saved.</p>
          ) : coinAwardStatus === "awarded" && coinResult ? (
            <>
              <p className="text-base font-semibold text-emerald-700">
                +{coinResult.awarded} Coins
              </p>
              {coinResult.isFirst && coinResult.bonus > 0 ? (
                <p className="text-sm font-medium text-amber-600">
                  Perfect! +{coinResult.bonus} Bonus!
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Awarding coins…</p>
          )}
        </div>
      )}
    </section>
  );
}
