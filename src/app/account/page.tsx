"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { RefreshCw, LogOut } from "lucide-react";

import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TrendChart } from "@/components/analytics/TrendChart";
import { getDisplayName, getAvatarUrl, initials } from "@/lib/auth/userDisplay";
import { PreferencesDialog } from "@/components/preferences/PreferencesDialog";
import { useCoins } from "@/lib/coins/CoinProvider";
import { formatCoinReason } from "@/lib/coins/formatReason";

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
  user_id: string | null;
  last_active_day: string | null;
  current_streak: number;
  longest_streak: number;
};

type AttemptsDailyFilledRow = {
  day: string;
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

type ContentPreferencesRow = {
  categories: string[];
  channels: string[];
};

type CoinTransaction = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
};

type CoinSectionRow = {
  todaysEarnings: number;
  recentActivity: CoinTransaction[];
};

type Section<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

function initialSection<T>(data: T): Section<T> {
  return { data, loading: true, error: null };
}

function formatDate(yyyy_mm_dd: string) {
  const [y, m, d] = yyyy_mm_dd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return yyyy_mm_dd;
  return `${m}/${d}`;
}

function getTodayAttempts(data: AttemptsDailyFilledRow[]) {
  if (data.length === 0) return 0;
  return data[data.length - 1]?.attempts_count ?? 0;
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

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-lg">{icon}</span>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function StatCard({
  title,
  value,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 text-2xl font-semibold">
        {loading ? <Skeleton className="h-8 w-16" /> : value}
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const { balance } = useCoins();

  const [authChecked, setAuthChecked] = React.useState(false);
  const [user, setUser] = React.useState<User | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  const [perf, setPerf] = React.useState<Section<PerformanceOverviewRow | null>>(
    initialSection(null)
  );
  const [streak, setStreak] = React.useState<Section<StreakRow | null>>(initialSection(null));
  const [attemptsDaily, setAttemptsDaily] = React.useState<Section<AttemptsDailyFilledRow[]>>(
    initialSection([])
  );
  const [attemptsCum, setAttemptsCum] = React.useState<Section<AttemptsCumulativeRow[]>>(
    initialSection([])
  );
  const [scoresDaily, setScoresDaily] = React.useState<Section<ScoresDailyFilledRow[]>>(
    initialSection([])
  );
  const [calendar90, setCalendar90] = React.useState<Section<CalendarDailyFilledRow[]>>(
    initialSection([])
  );
  const [recentFav, setRecentFav] = React.useState<Section<FavoriteWordRow[]>>(
    initialSection([])
  );
  const [contentPrefs, setContentPrefs] = React.useState<Section<ContentPreferencesRow>>(
    initialSection({ categories: [], channels: [] })
  );
  const [coins, setCoins] = React.useState<Section<CoinSectionRow>>(
    initialSection({ todaysEarnings: 0, recentActivity: [] })
  );
  const [editPrefsOpen, setEditPrefsOpen] = React.useState(false);

  async function loadContentPrefs(uid: string) {
    const [catRes, chRes] = await Promise.all([
      supabase.from("favorite_categories").select("category_name").eq("user_id", uid),
      supabase.from("favorite_channels").select("channel_name").eq("user_id", uid),
    ]);

    setContentPrefs({
      data: {
        categories: (catRes.data ?? []).map((r: any) => r.category_name),
        channels: (chRes.data ?? []).map((r: any) => r.channel_name),
      },
      loading: false,
      error: catRes.error?.message ?? chRes.error?.message ?? null,
    });
  }

  async function loadAll() {
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const currentUser = userRes?.user;

    if (userErr || !currentUser) {
      router.replace("/login?next=/account");
      return;
    }

    setUser(currentUser);
    setAuthChecked(true);

    setPerf(initialSection(null));
    setStreak(initialSection(null));
    setAttemptsDaily(initialSection([]));
    setAttemptsCum(initialSection([]));
    setScoresDaily(initialSection([]));
    setCalendar90(initialSection([]));
    setRecentFav(initialSection([]));
    setContentPrefs(initialSection({ categories: [], channels: [] }));
    setCoins(initialSection({ todaysEarnings: 0, recentActivity: [] }));

    const uid = currentUser.id;

    void loadContentPrefs(uid);

    supabase
      .from("v_account_performance_overview")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data, error }) =>
        setPerf({ data: (data as any) ?? null, loading: false, error: error?.message ?? null })
      );

    supabase
      .from("v_account_learning_streaks")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data, error }) =>
        setStreak({ data: (data as any) ?? null, loading: false, error: error?.message ?? null })
      );

    supabase
      .from("v_account_quiz_attempts_daily_30_filled")
      .select("day,attempts_count")
      .eq("user_id", uid)
      .order("day", { ascending: true })
      .then(({ data, error }) =>
        setAttemptsDaily({ data: (data as any) ?? [], loading: false, error: error?.message ?? null })
      );

    supabase
      .from("v_account_quiz_attempts_cumulative_30")
      .select("day,attempts_count,attempts_cumulative")
      .eq("user_id", uid)
      .order("day", { ascending: true })
      .then(({ data, error }) =>
        setAttemptsCum({ data: (data as any) ?? [], loading: false, error: error?.message ?? null })
      );

    supabase
      .from("v_account_quiz_scores_daily_30_filled")
      .select("day,attempts_count,avg_score_percent,accuracy_percent")
      .eq("user_id", uid)
      .order("day", { ascending: true })
      .then(({ data, error }) =>
        setScoresDaily({ data: (data as any) ?? [], loading: false, error: error?.message ?? null })
      );

    supabase
      .from("v_account_learning_calendar_daily_90_filled")
      .select("day,events_count,duration_seconds_sum,did_quiz,did_favorite,did_review")
      .eq("user_id", uid)
      .order("day", { ascending: true })
      .then(({ data, error }) =>
        setCalendar90({ data: (data as any) ?? [], loading: false, error: error?.message ?? null })
      );

    supabase
      .from("favorite_words")
      .select("word,pronunciation,definition,example,slug,video_id,created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(12)
      .then(({ data, error }) =>
        setRecentFav({ data: (data as any) ?? [], loading: false, error: error?.message ?? null })
      );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    Promise.all([
      supabase
        .from("coin_transactions")
        .select("amount")
        .eq("user_id", uid)
        .gte("created_at", startOfToday.toISOString()),
      supabase
        .from("coin_transactions")
        .select("id,amount,reason,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(10),
    ]).then(([todayRes, recentRes]) => {
      const todaysEarnings = (todayRes.data ?? []).reduce(
        (sum: number, row: { amount: number }) => sum + row.amount,
        0
      );
      setCoins({
        data: {
          todaysEarnings,
          recentActivity: (recentRes.data ?? []) as CoinTransaction[],
        },
        loading: false,
        error: todayRes.error?.message ?? recentRes.error?.message ?? null,
      });
    });
  }

  React.useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anyLoading =
    perf.loading ||
    streak.loading ||
    attemptsDaily.loading ||
    attemptsCum.loading ||
    scoresDaily.loading ||
    calendar90.loading ||
    recentFav.loading ||
    contentPrefs.loading ||
    coins.loading;

  const sectionErrors = [
    perf.error,
    streak.error,
    attemptsDaily.error,
    attemptsCum.error,
    scoresDaily.error,
    calendar90.error,
    recentFav.error,
    contentPrefs.error,
    coins.error,
  ].filter((e): e is string => Boolean(e));

  async function onSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function calendarCellClass(events: number) {
    if (events <= 0) return "bg-muted/40";
    if (events === 1) return "bg-emerald-100";
    if (events === 2) return "bg-emerald-200";
    if (events === 3) return "bg-emerald-300";
    return "bg-emerald-400";
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 space-y-10">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Account</h1>
        <Button variant="ghost" size="sm" onClick={loadAll} disabled={anyLoading}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Errors */}
      {sectionErrors.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-1">
            {sectionErrors.map((message, i) => (
              <p key={i} className="text-sm text-red-600">
                {message}
              </p>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* ─── 👤 Profile ─────────────────────────────────────── */}
      <section className="space-y-3">
        <Card>
          <CardContent className="p-6 space-y-4">
            {!authChecked ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={getAvatarUrl(user!) ?? undefined} />
                  <AvatarFallback>{initials(getDisplayName(user!))}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{getDisplayName(user!)}</div>
                  <div className="text-sm text-muted-foreground">{user!.email}</div>
                </div>
              </div>
            )}

            <Separator />

            {/* Content Preferences */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">🎯 Content Preferences</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setEditPrefsOpen(true)}
                >
                  Edit
                </Button>
              </div>
              {contentPrefs.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-20 mt-2" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-28 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Categories</p>
                    {contentPrefs.data.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {contentPrefs.data.categories.map((c) => (
                          <Badge key={c} variant="secondary">{c}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">None yet</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Channels</p>
                    {contentPrefs.data.channels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {contentPrefs.data.channels.slice(0, 3).map((ch) => (
                          <Badge key={ch} variant="secondary">{ch}</Badge>
                        ))}
                        {contentPrefs.data.channels.length > 3 ? (
                          <Badge variant="outline">
                            +{contentPrefs.data.channels.length - 3} more
                          </Badge>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">None yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <Button
              variant="outline"
              size="sm"
              onClick={onSignOut}
              disabled={!authChecked || signingOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* ─── 📚 Learning ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading icon="📚" title="Learning" />

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Total Attempts"
            loading={perf.loading}
            value={perf.data?.total_attempts ?? 0}
          />
          <StatCard
            title="Today's Attempts"
            loading={attemptsDaily.loading}
            value={getTodayAttempts(attemptsDaily.data)}
          />
          <StatCard
            title="Average Score"
            loading={perf.loading}
            value={`${perf.data?.avg_score_percent ?? 0}%`}
          />
          <StatCard
            title="Quiz Time"
            loading={perf.loading}
            value={secondsToHms(perf.data?.total_quiz_seconds ?? 0)}
          />
        </div>

        {/* Streak */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Streak</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-6 text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Current</div>
              <div className="text-xl font-semibold">
                {streak.loading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  `${streak.data?.current_streak ?? 0} days`
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Longest</div>
              <div className="text-xl font-semibold">
                {streak.loading ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  `${streak.data?.longest_streak ?? 0} days`
                )}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Last active</div>
              <div className="text-xl font-semibold">
                {streak.loading ? (
                  <Skeleton className="h-6 w-20" />
                ) : (
                  streak.data?.last_active_day ?? "—"
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Learning Calendar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Learning Calendar (Last 90 days)</CardTitle>
            <p className="text-xs text-muted-foreground">Days with activity are highlighted.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {calendar90.loading ? (
              <Skeleton className="h-24 w-full" />
            ) : calendar90.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="grid grid-cols-14 gap-1">
                {calendar90.data.map((c) => (
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
            )}
            <p className="text-xs text-muted-foreground">
              Streak grows automatically when you finish a quiz or add favorites.
            </p>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="space-y-3">
          <Card className="h-[360px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cumulative Quiz Attempts (Last 30 days)</CardTitle>
              <p className="text-xs text-muted-foreground">Running total of quiz attempts</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {attemptsCum.loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <TrendChart
                  data={attemptsCum.data.map((r) => ({ ...r, dayLabel: formatDate(r.day) }))}
                  lines={[{ dataKey: "attempts_cumulative", name: "Cumulative Attempts" }]}
                  emptyMessage="No quiz attempts in the last 30 days yet."
                />
              )}
            </CardContent>
          </Card>

          <Card className="h-[360px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Daily Quiz Attempts (Last 30 days)</CardTitle>
              <p className="text-xs text-muted-foreground">Number of quiz attempts per day</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {attemptsDaily.loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <TrendChart
                  data={attemptsDaily.data.map((r) => ({ ...r, dayLabel: formatDate(r.day) }))}
                  lines={[{ dataKey: "attempts_count", name: "Daily Attempts" }]}
                  emptyMessage="No quiz attempts in the last 30 days yet."
                />
              )}
            </CardContent>
          </Card>

          <Card className="h-[360px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Score Trend (Last 30 days)</CardTitle>
              <p className="text-xs text-muted-foreground">Daily average score and accuracy</p>
            </CardHeader>
            <CardContent className="h-[260px]">
              {scoresDaily.loading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <TrendChart
                  data={scoresDaily.data.map((r) => ({ ...r, dayLabel: formatDate(r.day) }))}
                  lines={[
                    { dataKey: "avg_score_percent", name: "Avg Score" },
                    { dataKey: "accuracy_percent", name: "Accuracy" },
                  ]}
                  yDomain={[0, 100]}
                  emptyMessage="No quiz scores in the last 30 days yet."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ─── 🪙 Coins ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading icon="🪙" title="Coins" />
        <Card>
          <CardContent className="p-6 space-y-4">
            {/* Balance + Today */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Current Coins</p>
                <div className="text-2xl font-semibold">
                  {balance ?? <Skeleton className="h-8 w-12" />}
                </div>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="text-xs text-muted-foreground">Today&apos;s Earnings</p>
                <div className="text-2xl font-semibold text-emerald-600">
                  {coins.loading ? (
                    <Skeleton className="h-8 w-12" />
                  ) : (
                    `+${coins.data.todaysEarnings}`
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Recent Activity</p>
              {coins.loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-4/5" />
                </div>
              ) : coins.data.recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No coins earned yet. Finish a quiz to get started.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {coins.data.recentActivity.map((tx) => (
                    <li
                      key={tx.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="text-muted-foreground">
                        {formatCoinReason(tx.reason)}
                      </span>
                      <span className="font-medium text-emerald-600">+{tx.amount}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── ⭐ Favorite Words ────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading icon="⭐" title="Favorite Words" />
        <Card>
          <CardContent className="p-6 space-y-3">
            {recentFav.loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : recentFav.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No favorites yet. Go to an article and tap the heart icon.
              </p>
            ) : (
              <div className="space-y-2">
                {recentFav.data.map((w) => (
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
      </section>

      <PreferencesDialog
        open={editPrefsOpen}
        onOpenChange={setEditPrefsOpen}
        mode="edit"
        onSaved={() => {
          if (user) void loadContentPrefs(user.id);
        }}
      />
    </main>
  );
}
