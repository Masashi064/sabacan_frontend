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

  // 進捗
  const answeredCount = Object.keys(selected).length;
  const correctCount = quiz.reduce((acc, q, i) => {
    const s = selected[i];
    return acc + (s && s === q.answer ? 1 : 0);
  }, 0);

  // 保存用（初回回答〜全問回答までの時間をクイズ所要時間として扱う）
  const startedAtMsRef = React.useRef<number | null>(null);
  const submittedRef = React.useRef(false);

  const [saveStatus, setSaveStatus] = React.useState<
    "idle" | "saving" | "saved" | "error" | "skipped"
  >("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);

  async function saveAttemptOnce() {
    if (submittedRef.current) return;
    submittedRef.current = true;

    // ログインしてなければスキップ（UIは動く）
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      setSaveStatus("skipped");
      return;
    }

    const now = new Date();
    const startedMs = startedAtMsRef.current ?? Date.now();
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedMs) / 1000));

    setSaveStatus("saving");
    setSaveError(null);

    const { error } = await supabase.from("quiz_attempts").insert({
      user_id: userRes.user.id,
      slug,
      video_id: videoId,
      total_questions: quiz.length,
      correct_count: correctCount,
      started_at: new Date(startedMs).toISOString(),
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
    });

    if (error) {
      setSaveStatus("error");
      setSaveError(error.message);
      return;
    }

    setSaveStatus("saved");
  }

  // 全問回答した瞬間に保存（1回だけ）
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

        {/* 保存ステータス（小さく表示） */}
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
                          if (isAnswered) return; // 1回回答したら固定（仕様どおり）

                          // 初回回答で開始時刻を記録
                          if (startedAtMsRef.current === null) {
                            startedAtMsRef.current = Date.now();
                          }

                          setSelected((prev) => ({ ...prev, [idx]: choice }));
                        }}
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
