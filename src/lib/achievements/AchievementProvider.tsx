"use client";

import * as React from "react";

export type AchievementUnlock = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  coin_reward: number;
  context: string | null;
};

type AchievementContextValue = {
  toasts: AchievementUnlock[];
  notifyAchievements: (unlocks: Omit<AchievementUnlock, "id">[]) => void;
};

const AchievementContext = React.createContext<AchievementContextValue | null>(null);

const TOAST_DURATION_MS = 5000;

export function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<AchievementUnlock[]>([]);

  const notifyAchievements = React.useCallback(
    (unlocks: Omit<AchievementUnlock, "id">[]) => {
      if (unlocks.length === 0) return;

      // Stagger toasts: first appears immediately, each subsequent one
      // waits 600ms longer so they don't all pop at once.
      unlocks.forEach((unlock, i) => {
        const id = `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
        setTimeout(() => {
          setToasts((prev) => [...prev, { id, ...unlock }]);
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, TOAST_DURATION_MS);
        }, i * 600);
      });
    },
    []
  );

  const value = React.useMemo(
    () => ({ toasts, notifyAchievements }),
    [toasts, notifyAchievements]
  );

  return (
    <AchievementContext.Provider value={value}>{children}</AchievementContext.Provider>
  );
}

export function useAchievements() {
  const ctx = React.useContext(AchievementContext);
  if (!ctx) throw new Error("useAchievements must be used within AchievementProvider");
  return ctx;
}
