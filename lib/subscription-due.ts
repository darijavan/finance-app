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

// The next date on or after `today` that the subscription will be charged.
// Null when it never will (inactive handling is the caller's job).
export function nextChargeDate(sub: DueSub, today: string): string | null {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const day = Math.min(sub.day_of_month || 1, 28);
  if (sub.frequency !== "monthly" && sub.frequency !== "yearly") return null;
  // Scan forward at most 13 months to cover a yearly sub whose month just passed.
  for (let i = 0; i <= 13; i++) {
    const mm = ((m - 1 + i) % 12) + 1;
    const yy = y + Math.floor((m - 1 + i) / 12);
    if (sub.frequency === "yearly" && sub.month_of_year !== mm) continue;
    const date = `${yy}-${String(mm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (date < today) continue;
    if (sub.start_date && date < sub.start_date) continue;
    return date;
  }
  return null;
}

// The scheduled date in one month, regardless of whether it has passed.
export function scheduledDateInMonth(sub: DueSub, month: string): string | null {
  const m = Number(month.slice(5, 7));
  if (sub.frequency === "yearly" && sub.month_of_year !== m) return null;
  if (sub.frequency !== "yearly" && sub.frequency !== "monthly") return null;
  const date = `${month}-${String(Math.min(sub.day_of_month || 1, 28)).padStart(2, "0")}`;
  return sub.start_date && date < sub.start_date ? null : date;
}

// The date a subscription should be charged in `month`, or null when it is not
// due (wrong yearly month, due day after the cutoff, or before its start date).
// Days are clamped to 28 so every month has the charge day.
export function chargeDate(sub: DueSub, month: string, today: string): string | null {
  const date = scheduledDateInMonth(sub, month);
  return date != null && Number(date.slice(8, 10)) <= cutoffDay(month, today) ? date : null;
}
