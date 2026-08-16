import { assert, test } from "vitest";
import { observations } from "../lib/insights.ts";

const base = {
  month: "2026-08",
  today: "2026-08-12",
  currency: "ILS",
  spent: 900,
  earned: 2_000,
  net: 1_100,
  previousSpent: [1_000, 1_100, 900],
  recurringMonthly: 100,
  remainingSubscriptions: 0,
  categories: [],
  budgets: [],
};

test("observations prioritize an over-budget category and link to its budget", () => {
  const result = observations({
    ...base,
    budgets: [{ categoryId: 4, categoryName: "Food", budget: 500, actual: 600 }],
  });

  assert.equal(result[0]?.id, "budget-4");
  assert.equal(result[0]?.tone, "urgent");
  assert.equal(result[0]?.href, "/budgets?month=2026-08");
});

test("observations require sufficient history before flagging category spending", () => {
  const category = { id: 7, name: "Transport", total: 160, previousTotals: [100, 100] };
  const result = observations({ ...base, categories: [category] });

  assert.ok(result.some((insight) => insight.id === "spending-7"));
  assert.equal(observations({ ...base, categories: [{ ...category, previousTotals: [100] }] }).length, 0);
});

test("observations warn when unpaid subscriptions erase the current surplus", () => {
  const result = observations({ ...base, net: 200, remainingSubscriptions: 250 });

  assert.ok(result.some((insight) => insight.id === "remaining-subscriptions"));
});