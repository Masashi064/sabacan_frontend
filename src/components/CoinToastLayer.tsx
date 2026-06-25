"use client";

import { useCoins } from "@/lib/coins/CoinProvider";

export function CoinToastLayer() {
  const { toasts } = useCoins();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <span
          key={t.id}
          className="animate-in fade-in slide-in-from-bottom-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg whitespace-nowrap"
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}
