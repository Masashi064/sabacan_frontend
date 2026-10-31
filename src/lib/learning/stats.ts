export type AttemptsDailyRow = { day: string; attempts_count: number };
export type StreakRow = {
  user_id: string | null;
  last_active_day: string | null;
  current_streak: number;
  longest_streak: number;
};

// Preserve Account's ordered-view semantics; the database owns the day boundary.
export function getTodayAttempts(rows: AttemptsDailyRow[]) {
  return rows.at(-1)?.attempts_count ?? 0;
}

// Refresh at midnight in the app's JST, UTC, and browser timezone. This does
// not calculate statistics locally or assume the view's timezone.
export function nextDayRefresh(now: Date) {
  const local = new Date(now);
  local.setHours(24, 0, 0, 0);
  const day = 86_400_000;
  const utc = (Math.floor(now.getTime() / day) + 1) * day;
  const jst = (Math.floor((now.getTime() + 9 * 3_600_000) / day) + 1) * day - 9 * 3_600_000;
  return Math.min(local.getTime(), utc, jst) - now.getTime() + 100;
}
