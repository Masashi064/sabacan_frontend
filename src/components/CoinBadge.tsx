"use client";

import { Badge } from "@/components/ui/badge";
import { useCoins } from "@/lib/coins/CoinProvider";

export function CoinBadge({ hasSession }: { hasSession: boolean }) {
  const { balance } = useCoins();

  if (!hasSession) return null;

  return (
    <Badge variant="secondary" className="px-2.5 py-1 text-sm">
      🪙 {balance ?? "…"}
    </Badge>
  );
}
