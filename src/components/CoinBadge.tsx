"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { useCoins } from "@/lib/coins/CoinProvider";
import { CoinWalletDialog } from "@/components/CoinWalletDialog";

export function CoinBadge({ hasSession }: { hasSession: boolean }) {
  const { balance } = useCoins();
  const [open, setOpen] = React.useState(false);

  if (!hasSession) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open coin wallet"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Badge
          variant="secondary"
          className="px-2.5 py-1 text-sm cursor-pointer hover:bg-secondary/80"
        >
          🪙 {balance ?? "…"}
        </Badge>
      </button>

      <CoinWalletDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
