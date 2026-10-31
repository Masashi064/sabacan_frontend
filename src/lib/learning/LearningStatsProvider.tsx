"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabaseBrowser } from "@/lib/supabase/client";
import { getTodayAttempts, nextDayRefresh, type AttemptsDailyRow, type StreakRow } from "./stats";

type Section<T> = { data: T; loading: boolean; error: string | null };
type Stats = {
  attemptsDaily: Section<AttemptsDailyRow[]>;
  streak: Section<StreakRow | null>;
};
export type LearningReward = { id: string; attempts: boolean; streak: boolean };
type RewardListener = (reward: LearningReward) => void;
type PendingReward = { id: string; before: Stats };
const emptyStats = (): Stats => ({
  attemptsDaily: { data: [], loading: true, error: null },
  streak: { data: null, loading: true, error: null },
});
const Context = React.createContext<(Stats & {
  todayCount: number | null;
  currentStreak: number | null;
  refresh: () => Promise<void>;
  notifySaved: (userId: string, quizCompletionId?: string) => void;
  subscribeToRewards: (listener: RewardListener) => () => void;
}) | null>(null);
const CHANNEL = "sabacan-learning-saved";

export function LearningStatsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // A different identity gets a fresh store immediately, including while requests
  // from the previous identity are still in flight.
  return <UserStats key={user?.id ?? "guest"} userId={user?.id ?? null}>{children}</UserStats>;
}

function UserStats({ userId, children }: { userId: string | null; children: React.ReactNode }) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [stats, setStats] = React.useState(emptyStats);
  const confirmed = React.useRef<Stats>(emptyStats());
  const pendingReward = React.useRef<PendingReward | null>(null);
  const seenQuizCompletions = React.useRef(new Set<string>());
  const rewardListeners = React.useRef(new Set<RewardListener>());
  const active = React.useRef(false);
  const pending = React.useRef<Promise<void> | null>(null);
  const revision = React.useRef(0);
  const channel = React.useRef<BroadcastChannel | null>(null);
  const pathname = usePathname();

  const refresh = React.useCallback((invalidate = false): Promise<void> => {
    if (!userId || !active.current) return Promise.resolve();
    if (pending.current) {
      if (invalidate) revision.current++;
      return pending.current;
    }
    revision.current++;
    pending.current = (async () => {
      let started: number;
      do {
        started = revision.current;
        try {
          const [attempts, streak] = await Promise.all([
            supabase.from("v_account_quiz_attempts_daily_30_filled")
              .select("day,attempts_count").eq("user_id", userId).order("day", { ascending: true }),
            supabase.from("v_account_learning_streaks").select("*").eq("user_id", userId).maybeSingle(),
          ]);
          // If a save occurred during this read, discard it and read again.
          if (active.current && started === revision.current) {
            const next: Stats = {
              attemptsDaily: { data: attempts.data ?? [], loading: false, error: attempts.error?.message ?? null },
              streak: { data: streak.data, loading: false, error: streak.error?.message ?? null },
            };
            confirmed.current = next;
            setStats(next);
            // Consume only the local quiz event attached to this read. A failed
            // read must not leave a reward waiting for an unrelated later fetch.
            const reward = pendingReward.current;
            pendingReward.current = null;
            if (reward) {
              const before = reward.before;
              const attemptsIncreased = !before.attemptsDaily.loading && !before.attemptsDaily.error && !next.attemptsDaily.error
                && before.attemptsDaily.data.at(-1)?.day === next.attemptsDaily.data.at(-1)?.day
                && getTodayAttempts(next.attemptsDaily.data) > getTodayAttempts(before.attemptsDaily.data);
              const streakIncreased = !before.streak.loading && !before.streak.error && !next.streak.error
                && (next.streak.data?.current_streak ?? 0) > (before.streak.data?.current_streak ?? 0);
              if ((attemptsIncreased || streakIncreased) && document.visibilityState === "visible") {
                rewardListeners.current.forEach((listener) => listener({
                  id: reward.id, attempts: attemptsIncreased, streak: streakIncreased,
                }));
              }
            }
          }
        } catch (error) {
          if (active.current && started === revision.current) {
            pendingReward.current = null;
            const message = error instanceof Error ? error.message : "Failed to load learning stats";
            setStats({
              attemptsDaily: { data: [], loading: false, error: message },
              streak: { data: null, loading: false, error: message },
            });
          }
        }
      } while (active.current && started !== revision.current);
    })().finally(() => { pending.current = null; });
    return pending.current;
  }, [supabase, userId]);

  React.useEffect(() => {
    active.current = true;
    if (!userId) return () => { active.current = false; };
    const onReturn = () => { if (document.visibilityState === "visible") void refresh(); };
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => { void refresh(); schedule(); }, nextDayRefresh(new Date()));
    };
    schedule();
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(CHANNEL);
      channel.current.onmessage = (event) => {
        if (event.data === userId) {
          pendingReward.current = null;
          void refresh(true);
        }
      };
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === CHANNEL && event.newValue?.startsWith(`${userId}:`)) {
        pendingReward.current = null;
        void refresh(true);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      active.current = false;
      pendingReward.current = null;
      clearTimeout(timer);
      channel.current?.close();
      channel.current = null;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [refresh, userId]);

  React.useEffect(() => { void refresh(); }, [pathname, refresh]);

  const notifySaved = React.useCallback((savedUserId: string, quizCompletionId?: string) => {
    if (savedUserId !== userId || !active.current) return;
    if (quizCompletionId) {
      if (seenQuizCompletions.current.has(quizCompletionId)) return;
      seenQuizCompletions.current.add(quizCompletionId);
      pendingReward.current = { id: quizCompletionId, before: confirmed.current };
    } else {
      // Favorites update the streak too, but never earn a quiz reward.
      pendingReward.current = null;
    }
    void refresh(true);
    if (channel.current) channel.current.postMessage(savedUserId);
    else {
      try { localStorage.setItem(CHANNEL, `${savedUserId}:${Date.now()}:${Math.random()}`); }
      catch { /* Focus refresh still works if browser storage is disabled. */ }
    }
  }, [refresh, userId]);

  const subscribeToRewards = React.useCallback((listener: RewardListener) => {
    rewardListeners.current.add(listener);
    return () => { rewardListeners.current.delete(listener); };
  }, []);

  return <Context.Provider value={{
    ...stats,
    todayCount: stats.attemptsDaily.loading || stats.attemptsDaily.error ? null : getTodayAttempts(stats.attemptsDaily.data),
    currentStreak: stats.streak.loading || stats.streak.error ? null : stats.streak.data?.current_streak ?? 0,
    refresh, notifySaved, subscribeToRewards,
  }}>{children}</Context.Provider>;
}

// An ephemeral subscription rather than cached animation state: mounting a new
// header, account page, or tab can never replay a previous completion.
export function useLearningReward() {
  const { subscribeToRewards } = useLearningStats();
  const [reward, setReward] = React.useState<LearningReward | null>(null);
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const unsubscribe = subscribeToRewards((next) => {
      clearTimeout(timer);
      setReward(next);
      timer = setTimeout(() => setReward(null), 900);
    });
    return () => { unsubscribe(); clearTimeout(timer); };
  }, [subscribeToRewards]);
  return reward;
}

export function useLearningStats() {
  const context = React.useContext(Context);
  if (!context) throw new Error("useLearningStats requires LearningStatsProvider");
  return context;
}
