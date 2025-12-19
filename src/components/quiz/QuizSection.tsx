"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseBrowser } from "@/lib/supabase/client";

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
}: {
  quiz: QuizQuestion[];
  slug: string;
  videoId: string | null;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [selected, setSelected] = React.useState<Record<number, string>>({});

  // progress
  const answeredCount = Object.keys(selected).length;
  const correctCount = quiz.reduce((acc, q, i) => {
    const s = selected[i];
    return acc + (s && s === q.answer ? 1 : 0);
  }, 0);

  // fallback: first answer -> finished
  const firstAnswerAtMsRef = React.useRef<number | null>(null);
  const submittedRef = React.useRef(false);

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
  }

  // Save the moment all questions are answered
  React.useEffect(() => {
    if (quiz.length === 0) return;
    if (answeredCount !== quiz.length) return;
    void saveAttemptOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, quiz.length]);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Quiz</h2>
          <p className="text-sm text-muted-foreground">
            {answeredCount}/{quiz.length} answered • {correctCount} correct
          </p>
        </div>

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
      </div>

      <div className="space-y-4">
        {quiz.map((q, idx) => {
          const picked = selected[idx];
          const isAnswered = typeof picked === "string";
          const isCorrect = isAnswered && picked === q.answer;

          return (
            <Card key={idx} className="overflow-hidden">
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">
                  Q{idx + 1}. {q.question}
                </CardTitle>

                {!isAnswered ? (
                  <p className="text-sm text-muted-foreground">Choose an answer.</p>
                ) : isCorrect ? (
                  <p className="text-sm font-medium text-emerald-700">Correct ✅</p>
                ) : (
                  <p className="text-sm font-medium text-red-700">Incorrect ❌</p>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
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
                        onClick={() => {
                          if (isAnswered) return; // lock after first pick

                          // fallback timer start (first answer)
                          if (firstAnswerAtMsRef.current === null) {
                            firstAnswerAtMsRef.current = Date.now();
                          }

                          setSelected((prev) => ({ ...prev, [idx]: choice }));
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span>{choice}</span>
                          {isAnswered && correct ? (
                            <span className="text-emerald-700 font-medium">
                              Answer
                            </span>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
