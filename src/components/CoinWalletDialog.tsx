"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useCoins } from "@/lib/coins/CoinProvider";
import { formatCoinReason } from "@/lib/coins/formatReason";

type Transaction = {
  id: number;
  amount: number;
  reason: string;
  created_at: string;
};

export function CoinWalletDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const supabase = React.useMemo(() => supabaseBrowser(), []);
  const { balance } = useCoins();

  const [loading, setLoading] = React.useState(true);
  const [todaysEarnings, setTodaysEarnings] = React.useState(0);
  const [recentActivity, setRecentActivity] = React.useState<Transaction[]>([]);

  React.useEffect(() => {
    if (!open) return;

    let alive = true;
    setLoading(true);

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;
      if (!user) {
        if (alive) {
          setTodaysEarnings(0);
          setRecentActivity([]);
          setLoading(false);
        }
        return;
      }

      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [todayRes, recentRes] = await Promise.all([
        supabase
          .from("coin_transactions")
          .select("amount")
          .eq("user_id", user.id)
          .gte("created_at", startOfToday.toISOString()),
        supabase
          .from("coin_transactions")
          .select("id,amount,reason,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!alive) return;

      const todaySum = (todayRes.data ?? []).reduce(
        (sum: number, row: { amount: number }) => sum + row.amount,
        0
      );
      setTodaysEarnings(todaySum);
      setRecentActivity((recentRes.data ?? []) as Transaction[]);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [open, supabase]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>🪙 Coin Wallet</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Current Coins</p>
            <p className="text-2xl font-semibold">{balance ?? "…"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Today&apos;s Earnings</p>
            <p className="text-2xl font-semibold text-emerald-600">
              {loading ? "…" : `+${todaysEarnings}`}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Recent Activity</p>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No coins earned yet. Finish a quiz to get started.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recentActivity.map((tx) => (
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
      </DialogContent>
    </Dialog>
  );
}
