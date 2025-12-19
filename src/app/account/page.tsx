"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download, RefreshCw } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type PerformanceOverviewRow = {
  user_id: string;
  total_attempts: number;
  total_correct: number;
  total_questions: number;
  overall_accuracy_percent: number;
  avg_score_percent: number;
  total_quiz_seconds: number;
  last_quiz_completed_at: string | null;
};

type StreakRow = {
  user_id: string;
  last_active_day: string | null;
  current_streak: number;
  longest_streak: number;
};

type AttemptsDailyFilledRow = {
  day: string; // YYYY-MM-DD
  attempts_count: number;
};

type AttemptsCumulativeRow = {
  day: string;
  attempts_count: number;
  attempts_cumulative: number;
};

type ScoresDailyFilledRow = {
  day: string;
  attempts_count: number;
  avg_score_percent: number;
  accuracy_percent: number;
};

type CalendarDailyFilledRow = {
  day: string;
  events_count: number;
  duration_seconds_sum: number;
  did_quiz: boolean;
  did_favorite: boolean;
  did_review: boolean;
};

type FavoriteWordRow = {
  word: string;
  pronunciation: string | null;
  definition: string | null;
  example: string | null;
  slug: string | null;
  video_id: string | null;
  created_at: string;
};

function formatDate(yyyy_mm_dd: string) {
  // show as MM/DD for charts (light & compact)
  const [y, m, d] = yyyy_mm_dd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return yyyy_mm_dd;
  return `${m}/${d}`;
}

function secondsToHms(totalSeconds: number) {
  const s = Math.max(0, totalSeconds | 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  const needs = /[",\n]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => supabaseBrowser(), []);

  const [loading, setLoading] = React.useState(true);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [perf, setPerf] = React.useState<PerformanceOverviewRow | null>(null);
  const [streak, setStreak] = React.useState<StreakRow | null>(null);

  const [attemptsDaily, setAttemptsDaily] = React.useState<AttemptsDailyFilledRow[]>([]);
  const [attemptsCum, setAttemptsCum] = React.useState<AttemptsCumulativeRow[]>([]);
  const [scoresDaily, setScoresDaily] = React.useState<ScoresDailyFilledRow[]>([]);
  const [calendar90, setCalendar90] = React.useState<CalendarDailyFilledRow[]>([]);

  const [recentFav, setRecentFav] = React.useState<FavoriteWordRow[]>([]);
  const [csvBusy, setCsvBusy] = React.useState(false);

  async function loadAll() {
    setError(null);
    setLoading(true);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user;

    if (userErr || !user) {
      router.replace("/login?next=/account");
      return;
    }

    setUserId(user.id);

    const [
      perfRes,
      streakRes,
      attemptsDailyRes,
      attemptsCumRes,
      scoresDailyRes,
      calendarRes,
      favRecentRes,
    ] = await Promise.all([
      supabase
        .from("v_account_performance_overview")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("v_account_learning_streaks")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("v_account_quiz_attempts_daily_30_filled")
        .select("day,attempts_count")
        .eq("user_id", user.id)
        .order("day", { ascending: true }),
      supabase
        .from("v_account_quiz_attempts_cumulative_30")
        .select("day,attempts_count,attempts_cumulative")
        .eq("user_id", user.id)
        .order("day", { ascending: true }),
      supabase
        .from("v_account_quiz_scores_daily_30_filled")
        .select("day,attempts_count,avg_score_percent,accuracy_percent")
        .eq("user_id", user.id)
        .order("day", { ascending: true }),
      supabase
        .from("v_account_learning_calendar_daily_90_filled")
        .select("day,events_count,duration_seconds_sum,did_quiz,did_favorite,did_review")
        .eq("user_id", user.id)
        .order("day", { ascending: true }),
      supabase
        .from("favorite_words")
        .select("word,pronunciation,definition,example,slug,video_id,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
    ]);

    const firstErr =
      perfRes.error ||
      streakRes.error ||
      attemptsDailyRes.error ||
      attemptsCumRes.error ||
      scoresDailyRes.error ||
      calendarRes.error ||
      favRecentRes.error;

    if (firstErr) {
      setError(firstErr.message);
    }

    setPerf((perfRes.data as any) ?? null);
    setStreak((streakRes.data as any) ?? null);

    setAttemptsDaily((attemptsDailyRes.data as any) ?? []);
    setAttemptsCum((attemptsCumRes.data as any) ?? []);
    setScoresDaily((scoresDailyRes.data as any) ?? []);
    setCalendar90((calendarRes.data as any) ?? []);
    setRecentFav((favRecentRes.data as any) ?? []);

    setLoading(false);
  }

  React.useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadFavoritesCsv() {
    if (!userId) return;
    setCsvBusy(true);

    const { data, error: favErr } = await supabase
      .from("favorite_words")
      .select("word,pronunciation,definition,example,slug,video_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    setCsvBusy(false);

    if (favErr) {
      setError(`CSV export failed: ${favErr.message}`);
      return;
    }

    const rows = (data ?? []) as FavoriteWordRow[];
    const header = [
      "word",
      "pronunciation",
      "definition",
      "example",
      "slug",
      "video_id",
      "created_at",
    ];

    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvEscape(r.word),
          csvEscape(r.pronunciation ?? ""),
          csvEscape(r.definition ?? ""),
          csvEscape(r.example ?? ""),
          csvEscape(r.slug ?? ""),
          csvEscape(r.video_id ?? ""),
          csvEscape(r.created_at),
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "sabacan365-favorite-words.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  // Calendar intensity (simple levels)
  function calendarCellClass(events: number) {
    if (events <= 0) return "bg-muted/40";
    if (events === 1) return "bg-emerald-100";
    if (events === 2) return "bg-emerald-200";
    if (events === 3) return "bg-emerald-300";
    return "bg-emerald-400";
  }

  const calCells = calendar90; // already 90 days filled

  return (
    <main className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-muted-foreground">
            Performance, streaks, and vocabulary — all in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadAll} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={downloadFavoritesCsv} disabled={csvBusy || loading}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      {/* Top summary cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Attempts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {loading ? "—" : perf?.total_attempts ?? 0}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overall Accuracy</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {loading ? "—" : `${perf?.overall_accuracy_percent ?? 0}%`}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Average Score</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {loading ? "—" : `${perf?.avg_score_percent ?? 0}%`}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quiz Time (for now)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {loading ? "—" : secondsToHms(perf?.total_quiz_seconds ?? 0)}
          </CardContent>
        </Card>
      </div>

      {/* Streak */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Streak</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6 text-sm">
          <div>
            <div className="text-muted-foreground">Current</div>
            <div className="text-xl font-semibold">{loading ? "—" : streak?.current_streak ?? 0} days</div>
          </div>
          <div>
            <div className="text-muted-foreground">Longest</div>
            <div className="text-xl font-semibold">{loading ? "—" : streak?.longest_streak ?? 0} days</div>
          </div>
          <div>
            <div className="text-muted-foreground">Last active</div>
            <div className="text-xl font-semibold">{loading ? "—" : streak?.last_active_day ?? "—"}</div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="h-[360px]">
          <CardHeader>
            <CardTitle className="text-base">Quiz Attempts (Last 30 days)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Daily + cumulative (motivational “upward” view)
            </p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={attemptsCum.map((r) => ({
                  ...r,
                  dayLabel: formatDate(r.day),
                }))}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} interval={4} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="attempts_count" name="Daily" dot={false} />
                <Line type="monotone" dataKey="attempts_cumulative" name="Cumulative" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="h-[360px]">
          <CardHeader>
            <CardTitle className="text-base">Score Trend (Last 30 days)</CardTitle>
            <p className="text-sm text-muted-foreground">Daily average score and accuracy</p>
          </CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={scoresDaily.map((r) => ({
                  ...r,
                  dayLabel: formatDate(r.day),
                }))}
                margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} interval={4} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="avg_score_percent" name="Avg Score" dot={false} />
                <Line type="monotone" dataKey="accuracy_percent" name="Accuracy" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Calendar + Favorites */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Learning Calendar (Last 90 days)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Days with activity are highlighted.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-14 gap-1">
              {calCells.map((c) => (
                <div
                  key={c.day}
                  className={[
                    "h-4 w-full rounded",
                    "border border-border/40",
                    calendarCellClass(c.events_count),
                  ].join(" ")}
                  title={`${c.day} • events: ${c.events_count}`}
                />
              ))}
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground">
              Tip: streak/calendar grows automatically when you finish a quiz or add favorites.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Favorite Words</CardTitle>
            <p className="text-sm text-muted-foreground">
              Latest 12 favorites (export all via CSV button)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recentFav.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No favorites yet. Go to an article and tap the heart icon.
              </p>
            ) : (
              <div className="space-y-2">
                {recentFav.map((w) => (
                  <div
                    key={w.word}
                    className="rounded-md border p-3 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="font-medium">{w.word}</div>
                      {w.pronunciation ? (
                        <div className="text-xs text-muted-foreground">{w.pronunciation}</div>
                      ) : null}
                      {w.definition ? (
                        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {w.definition}
                        </div>
                      ) : null}
                    </div>

                    {w.slug ? (
                      <Button asChild variant="outline" size="sm" className="shrink-0">
                        <Link href={`/articles/${w.slug}`}>Open</Link>
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="text-xs text-muted-foreground">
        Learning time is currently based on quiz duration only. We can expand it later
        (sessions, reading time, vocab review, etc.).
      </div>
    </main>
  );
}
