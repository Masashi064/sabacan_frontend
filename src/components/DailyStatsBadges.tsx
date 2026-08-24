"use client";

import * as React from "react";
import { CalendarCheck, CheckCircle2, Flame } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

// Header-only stats: today's completed-quiz count + current streak. Both
// come from data already used on the account page (quiz_attempts,
// v_account_learning_streaks) — kept as two small queries here since the
// header renders on every route and must stay cheap.
export function DailyStatsBadges() {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const { user } = useAuth();
  const [todayCount, setTodayCount] = React.useState<number | null>(null);
  const [streak, setStreak] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!user) {
      setTodayCount(null);
      setStreak(null);
      return;
    }

    let alive = true;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    Promise.all([
      supabase
        .from("quiz_attempts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfToday.toISOString()),
      supabase
        .from("v_account_learning_streaks")
        .select("current_streak")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]).then(([todayRes, streakRes]) => {
      if (!alive) return;
      setTodayCount(todayRes.count ?? 0);
      setStreak((streakRes.data as { current_streak: number } | null)?.current_streak ?? 0);
    });

    return () => {
      alive = false;
    };
  }, [supabase, user]);

  if (!user) return null;

  const completedToday = (todayCount ?? 0) > 0;

  return (
    <div className="flex items-center gap-1.5">
      <Badge
        variant="secondary"
        className="px-2 py-1 text-xs font-medium gap-1"
        title="Quizzes completed today"
      >
        {completedToday ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <CalendarCheck className="h-3.5 w-3.5" />
        )}
        {todayCount ?? "…"}
      </Badge>
      <Badge
        variant="secondary"
        className="px-2 py-1 text-xs font-medium gap-1"
        title="Current streak"
      >
        {completedToday ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
        ) : (
          <Flame className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {streak ?? "…"}
      </Badge>
    </div>
  );
}
