"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Flame } from "lucide-react";

import { RewardValue } from "@/components/ui/reward-value";
import { Badge } from "@/components/ui/badge";
import { useLearningReward, useLearningStats } from "@/lib/learning/LearningStatsProvider";
import { useAuth } from "@/lib/auth/AuthProvider";

export function DailyStatsBadges() {
  const { user } = useAuth();
  const { todayCount, currentStreak: streak, attemptsDaily, streak: streakSection } = useLearningStats();

  const reward = useLearningReward();

  if (!user) return null;

  const completedToday = (todayCount ?? 0) > 0;

  return (
    <div className="flex items-center gap-1.5 max-[360px]:gap-1">
      <Badge
        asChild
        variant="secondary"
        className="px-2 max-[360px]:px-1.5 py-1 text-xs font-medium gap-1"
        title="Quizzes completed today"
      >
        <Link href="/account" aria-label="今日の取り組みを確認">
          <RewardValue
            value={todayCount ?? (attemptsDaily.error ? "—" : "…")}
            rewardId={reward?.attempts ? reward.id : undefined}
            icon={completedToday ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <CalendarCheck className="h-3.5 w-3.5" />
            )}
          />
        </Link>
      </Badge>
      <Badge
        asChild
        variant="secondary"
        className="px-2 max-[360px]:px-1.5 py-1 text-xs font-medium gap-1"
        title="Current streak"
      >
        <Link href="/account" aria-label="連続日数記録を確認">
          <RewardValue
            value={streak ?? (streakSection.error ? "—" : "…")}
            rewardId={reward?.streak ? reward.id : undefined}
            icon={completedToday ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-orange-500" />
            ) : (
              <Flame className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          />
        </Link>
      </Badge>
    </div>
  );
}
