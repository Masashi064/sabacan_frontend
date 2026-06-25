const REASON_LABELS: Record<string, string> = {
  quiz_correct: "Quiz correct",
  quiz_correct_repeat: "Quiz correct (repeat)",
  perfect_bonus: "Perfect bonus",
  daily_bonus: "Daily bonus",
  manual_adjustment: "Manual adjustment",
};

export function formatCoinReason(reason: string): string {
  return REASON_LABELS[reason] ?? reason.replace(/_/g, " ");
}
