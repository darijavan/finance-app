// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJSON: vi.fn().mockResolvedValue({ months: [] }),
  context: {
    month: "2026-08", sym: "₪", accounts: [], notify: vi.fn(),
    goals: [{ id: 1, name: "Emergency fund", target_amount: 1000, current: 250, account_id: 1, account_name: "Savings", currency: "ILS", target_date: "2026-12-31", note: "" }],
    summary: {
      spent: 0, earned: 0, net: 0, recurring_monthly: 0, remaining_subscriptions: 0,
      due_subscriptions: [], reimbursable_expenses: [], remaining_reimbursements: 0,
      insights: [], by_category: [], budgets: [],
    },
  },
}));

vi.mock("../app/(finance)/store", () => ({ useFinance: () => mocks.context }));
vi.mock("@/lib/client", () => ({
  API: "/api", getJSON: mocks.getJSON, fmt: (amount: number, symbol: string) => `${symbol}${amount}`,
  fmtCur: (amount: number, currency: string) => `${currency} ${amount}`,
}));

const { default: DashboardPage } = await import("../app/(finance)/page");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("shows linked-account savings goals and progress on the dashboard", () => {
  render(<DashboardPage />);

  expect(screen.getByRole("heading", { name: "Savings goals" })).toBeTruthy();
  expect(screen.getByText(/Emergency fund/)).toBeTruthy();
  expect(screen.getByText(/Savings · by 2026-12-31/)).toBeTruthy();
  expect(screen.getByText("ILS 250 / ILS 1000 (25%)")).toBeTruthy();
});
