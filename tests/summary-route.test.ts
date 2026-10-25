import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  getConverter: vi.fn(),
  observations: vi.fn(),
  materializeRecurringBudgets: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));
vi.mock("@/lib/fx", () => ({ getConverter: mocks.getConverter }));
vi.mock("@/lib/insights", () => ({ observations: mocks.observations }));
vi.mock("@/lib/budgets", () => ({ materializeRecurringBudgets: mocks.materializeRecurringBudgets }));

const { GET } = await import("../app/api/summary/route");

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("GET /api/summary", () => {
  it("rejects an invalid supplied month before reading financial data", async () => {
    const response = await GET(new NextRequest("http://localhost/api/summary?month=2026-13"));

    expect(response.status).toBe(400);
    expect(mocks.db.prepare).not.toHaveBeenCalled();
    expect(mocks.getConverter).not.toHaveBeenCalled();
  });

  it("aggregates converted ledger totals and reports only unpaid current-month expense subscriptions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));
    mocks.getConverter.mockResolvedValue({
      base: "ILS",
      toBase: (amount: number, currency: string) => currency === "USD" ? amount * 4 : amount,
    });
    mocks.observations.mockReturnValue([]);
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT t.amount")) {

        return { all: () => [
          { amount: 10, currency: "ILS", direction: "expense", category_id: 1, cat_name: "Food", cat_color: "#f00" },
          { amount: 5, currency: "USD", direction: "expense", category_id: 1, cat_name: "Food", cat_color: "#f00" },
          { amount: 100, currency: "ILS", direction: "income", category_id: null, cat_name: "Income", cat_color: "#0f0" },
        ] };
      }
      if (sql.startsWith("SELECT substr(date,1,7)")) {

        return { all: () => [] };
      }
      if (sql === "SELECT * FROM budgets WHERE month=? AND recurrence_deleted=0") {

        return { all: () => [] };
      }
      if (sql.startsWith("SELECT id, name, amount, currency, direction")) {

        return { all: () => [
          { id: 1, name: "Due", amount: 5, currency: "USD", direction: "expense", frequency: "monthly", day_of_month: 10, month_of_year: null, start_date: null },
          { id: 2, name: "Paid", amount: 8, currency: "ILS", direction: "expense", frequency: "monthly", day_of_month: 12, month_of_year: null, start_date: null },
          { id: 3, name: "Income", amount: 15, currency: "ILS", direction: "income", frequency: "monthly", day_of_month: 1, month_of_year: null, start_date: null },
          { id: 4, name: "Future", amount: 9, currency: "ILS", direction: "expense", frequency: "monthly", day_of_month: 20, month_of_year: null, start_date: "2026-09-01" },
        ] };
      }
      if (sql.startsWith("SELECT DISTINCT subscription_id")) {

        return { all: () => [{ subscription_id: 2 }] };
      }
      if (sql.startsWith("SELECT t.id, t.date")) {

        return { all: () => [] };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await GET(new NextRequest("http://localhost/api/summary?month=2026-08"));

    expect(response.status).toBe(200);
    expect(mocks.materializeRecurringBudgets).toHaveBeenCalledWith(mocks.db, "2026-08");
    expect(await response.json()).toEqual(expect.objectContaining({
      month: "2026-08",
      base: "ILS",
      spent: 30,
      earned: 100,
      net: 70,
      recurring_monthly: 52,
      remaining_subscriptions: 20,
      due_subscriptions: [{ id: 1, name: "Due", amount: 5, currency: "USD", date: "2026-08-10", overdue: true }],
      by_category: [{ name: "Food", color: "#f00", total: 30 }],
      insights: [],
    }));
  });
});
