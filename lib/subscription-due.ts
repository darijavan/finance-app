// Pure due-date logic for subscription charging, shared by the charge API and tests.

export interface DueSub {
  frequency: string;
  day_of_month: number | null;
  month_of_year: number | null;
  start_date: string | null;
}

// The latest day of `month` (YYYY-MM) that may be charged given `today` (YYYY-MM-DD):
// past months may backfill the whole month, the current month only up to today,
// and future months never.
export function cutoffDay(month: string, today: string): number {
  const currentMonth = today.slice(0, 7);
  if (month < currentMonth) return 28;
  if (month === currentMonth) return Number(today.slice(8, 10));
  return 0;
}

// The date a subscription should be charged in `month`, or null when it is not
// due (wrong yearly month, due day after the cutoff, or before its start date).
// Days are clamped to 28 so every month has the charge day.
export function chargeDate(sub: DueSub, month: string, today: string): string | null {
  const m = Number(month.slice(5, 7));
  if (sub.frequency === "yearly" && sub.month_of_year !== m) return null;
  if (sub.frequency !== "yearly" && sub.frequency !== "monthly") return null;
  const day = Math.min(sub.day_of_month || 1, 28);
  if (day > cutoffDay(month, today)) return null;
  const date = `${month}-${String(day).padStart(2, "0")}`;
  if (sub.start_date && date < sub.start_date) return null;
  return date;
}
