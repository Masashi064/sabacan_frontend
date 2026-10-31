import type { ReactNode } from "react";

/** Render the confirmed value immediately; only its presentation animates. */
export function RewardValue({ value, rewardId, icon }: {
  value: number | string;
  rewardId?: string;
  icon?: ReactNode;
}) {
  return (
    <span className="reward-value" data-reward={rewardId ? "active" : undefined}>
      <span key={`icon-${rewardId ?? "idle"}`} className="reward-value-icon">{icon}</span>
      <span className="reward-value-number">
        <span key={rewardId ?? "idle"} className="reward-value-digit">{value}</span>
        {rewardId ? <span key={`shine-${rewardId}`} className="reward-value-shine" aria-hidden="true" /> : null}
      </span>
    </span>
  );
}
