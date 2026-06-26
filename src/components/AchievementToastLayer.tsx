"use client";

import { useAchievements } from "@/lib/achievements/AchievementProvider";

export function AchievementToastLayer() {
  const { toasts } = useAchievements();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-full max-w-sm px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-in fade-in slide-in-from-bottom-3 w-full rounded-xl border bg-card shadow-lg overflow-hidden"
        >
          {/* Header */}
          <div className="bg-amber-500 px-4 py-1.5">
            <p className="text-xs font-semibold text-white tracking-wide">
              🏆 Achievement Unlocked!
            </p>
          </div>

          {/* Body */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl shrink-0" aria-hidden="true">
                {t.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">
                  {t.name}
                  {t.context ? (
                    <span className="font-normal text-muted-foreground">: {t.context}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {t.description}
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold text-amber-600 whitespace-nowrap">
              +{t.coin_reward} 🪙
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
