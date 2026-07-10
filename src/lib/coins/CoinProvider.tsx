"use client";

import * as React from "react";

import { supabaseBrowser } from "@/lib/supabase/client";

type CoinContextValue = {
  balance: number | null;
  refreshBalance: () => Promise<void>;
};

const CoinContext = React.createContext<CoinContextValue | null>(null);

export function CoinProvider({ children }: { children: React.ReactNode }) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const [balance, setBalance] = React.useState<number | null>(null);

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
    () => ({ balance, refreshBalance }),
    [balance, refreshBalance]
  );

  return <CoinContext.Provider value={value}>{children}</CoinContext.Provider>;
}

export function useCoins() {
  const ctx = React.useContext(CoinContext);
  if (!ctx) throw new Error("useCoins must be used within a CoinProvider");
  return ctx;
}
