"use client";

import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

type RewardToast = { id: string; amount: number; label: string };

type CoinContextValue = {
  balance: number | null;
  refreshBalance: () => Promise<void>;
  notifyReward: (toast: { amount: number; label: string }) => void;
  toasts: RewardToast[];
};

const CoinContext = React.createContext<CoinContextValue | null>(null);

const TOAST_DURATION_MS = 2800;

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [toasts, setToasts] = React.useState<RewardToast[]>([]);

  const refreshBalance = React.useCallback(async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      setBalance(null);
      return;
    }

    const { data } = await supabase
      .from("v_coin_balance")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();

    setBalance((data as any)?.balance ?? 0);
  }, [supabase]);

  const notifyReward = React.useCallback((toast: { amount: number; label: string }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  React.useEffect(() => {
    void refreshBalance();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void refreshBalance();
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase, refreshBalance]);

  const value = React.useMemo(
    () => ({ balance, refreshBalance, notifyReward, toasts }),
    [balance, refreshBalance, notifyReward, toasts]
  );

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
}

export function useCoins() {
  const ctx = React.useContext(CoinContext);
  if (!ctx) throw new Error("useCoins must be used within a CoinProvider");
  return ctx;
}
