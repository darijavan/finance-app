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

it("shows remaining subscriptions in the Figma v2 headline stats", () => {
  mocks.context.betaDesign = true;
  mocks.context.summary.remaining_subscriptions = 75;
  render(<DashboardPage />);

  expect(screen.getByText("Remaining subscriptions")).toBeTruthy();
  expect(screen.getByText("₪75")).toBeTruthy();
  expect(screen.queryByText("Net")).toBeNull();
});

it("uses the compact Figma panels for beta spending and outstanding items", () => {
  mocks.context.betaDesign = true;
  mocks.context.summary.by_category = [{ name: "Food", color: "#f00", total: 30 }];
  mocks.context.summary.budgets = [{ category_name: "Food", rollover: false, actual: 30, budget: 100, color: "#f00" }];
  mocks.context.summary.reimbursable_expenses = [{ id: 1, date: "2026-08-12", note: "Lunch", category_name: "Food", amount: 30, currency: "ILS" }];
  mocks.context.summary.due_subscriptions = [{ id: 2, date: "2026-08-10", name: "Music", amount: 15, currency: "ILS", overdue: true }];
  render(<DashboardPage />);

  expect(screen.getByRole("heading", { name: "Spending & budgets" })).toBeTruthy();
  expect(screen.getAllByText("Food")).toHaveLength(2);
  expect(document.querySelectorAll(".category-dot")).toHaveLength(2);
  expect(document.querySelectorAll(".spending-progress")).toHaveLength(2);
  expect(screen.getByText("Reimbursement pending")).toBeTruthy();
  expect(screen.getByText("Overdue")).toBeTruthy();
  expect(document.querySelectorAll("table")).toHaveLength(0);
});
