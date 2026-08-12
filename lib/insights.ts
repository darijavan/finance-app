export type InsightTone = "positive" | "attention" | "urgent";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  href: string;
  action: string;
}

export interface InsightInput {
  month: string;
  today: string;
  currency: string;
  spent: number;
  earned: number;
  net: number;
  previousSpent: number[];
  recurringMonthly: number;
  remainingSubscriptions: number;
  categories: { id: number | null; name: string; total: number; previousTotals: number[] }[];
  budgets: { categoryId: number | null; categoryName: string; budget: number; actual: number }[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number, currency: string) => `${currency} ${r2(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export function observations(input: InsightInput): Insight[] {
  const out: Insight[] = [];
  const currentMonth = input.today.slice(0, 7);

  for (const budget of input.budgets) {
    if (budget.budget <= 0 || budget.actual < budget.budget * 0.8) continue;
    const percent = Math.round((budget.actual / budget.budget) * 100);
    const over = budget.actual > budget.budget;
    out.push({
      id: `budget-${budget.categoryId ?? "overall"}`,
      tone: over ? "urgent" : "attention",
      title: over ? `${budget.categoryName} is over budget` : `${budget.categoryName} is close to its budget`,
      detail: `${money(budget.actual, input.currency)} spent of ${money(budget.budget, input.currency)} (${percent}%).`,
      href: `/budgets?month=${input.month}`,
      action: "Review budget",
    });
  }

  for (const category of input.categories) {
    if (category.previousTotals.length < 2) continue;
    const average = category.previousTotals.reduce((sum, total) => sum + total, 0) / category.previousTotals.length;
    const increase = category.total - average;
    if (average <= 0 || increase < Math.max(25, average * 0.3)) continue;
    const percent = Math.round((increase / average) * 100);
    out.push({
      id: `spending-${category.id ?? "uncategorized"}`,
      tone: "attention",
      title: `${category.name} spending is above its recent norm`,
      detail: `${money(category.total, input.currency)} this month — ${percent}% above the ${category.previousTotals.length}-month average of ${money(average, input.currency)}.`,
      href: `/transactions?month=${input.month}&category_id=${category.id ?? ""}`,
      action: "Review transactions",
    });
  }

  if (input.month === currentMonth && input.remainingSubscriptions > 0 && input.net - input.remainingSubscriptions < 0) {
    out.push({
      id: "remaining-subscriptions",
      tone: "urgent",
      title: "Remaining subscriptions would put this month in deficit",
      detail: `${money(input.remainingSubscriptions, input.currency)} is still due; the current net is ${money(input.net, input.currency)}.`,
      href: `/subscriptions?month=${input.month}`,
      action: "Review subscriptions",
    });
  }

  if (input.earned > 0 && input.recurringMonthly / input.earned >= 0.2) {
    const share = Math.round((input.recurringMonthly / input.earned) * 100);
    out.push({
      id: "recurring-share",
      tone: "attention",
      title: "Recurring commitments take a notable share of income",
      detail: `${money(input.recurringMonthly, input.currency)} per month is ${share}% of this month's income.`,
      href: `/subscriptions?month=${input.month}`,
      action: "Review subscriptions",
    });
  }

  if (input.previousSpent.length >= 2) {
    const average = input.previousSpent.reduce((sum, total) => sum + total, 0) / input.previousSpent.length;
    if (average > 0 && input.spent <= average * 0.8) {
      out.push({
        id: "lower-spending",
        tone: "positive",
        title: "Spending is below your recent average",
        detail: `${money(input.spent, input.currency)} this month versus a ${input.previousSpent.length}-month average of ${money(average, input.currency)}.`,
        href: `/transactions?month=${input.month}`,
        action: "View spending",
      });
    }
  }

  const weight = { urgent: 0, attention: 1, positive: 2 };

  return out.sort((a, b) => weight[a.tone] - weight[b.tone]).slice(0, 5);
}
