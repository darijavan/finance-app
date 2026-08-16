// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJSON: vi.fn(),
  search: "account_id=7",
  context: {
    month: "2026-08",
    settings: { currency: "ILS", currency_symbol: "₪" },
    categories: [],
    accounts: [
      { id: 7, name: "Checking", currency: "ILS" },
      { id: 8, name: "Savings", currency: "ILS" },
    ],
    transactions: [],
    expenseCats: [],
    incomeCats: [],
    reloadKey: 0,
    reload: vi.fn(),
    notify: vi.fn(),
    confirm: vi.fn(),
    undo: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }));
vi.mock("../app/(finance)/store", () => ({ useFinance: () => mocks.context }));
vi.mock("@/lib/client", () => ({
  API: "/api", getJSON: mocks.getJSON, sendJSON: vi.fn(), fmtCur: (amount: number) => String(amount),
  catName: () => "Other", catColor: () => "#888", CURRENCIES: [],
}));

const { default: TransactionsPage } = await import("../app/(finance)/transactions/page");

afterEach(() => {
  cleanup();
  mocks.search = "account_id=7";
  vi.clearAllMocks();
  vi.useRealTimers();
});

it("shows account transfers separately from filtered transaction results", async () => {
  vi.useFakeTimers();
  mocks.getJSON.mockImplementation((url: string) => Promise.resolve(url.includes("/transfers")
    ? [{ id: 8, date: "2026-07-15", from_account: 7, to_account: 2, from_name: "Checking", to_name: "Cash", amount: 100, currency: "ILS", note: "ATM" }]
    : [{ id: 1, date: "2026-07-16", direction: "expense", amount: 50, currency: "ILS", category_id: null, account_id: 7, reimbursable: false }]));

  render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(mocks.getJSON).toHaveBeenCalledWith("/api/transfers?account_id=7");
  expect(screen.getByText("Search results (1, all months)")).toBeTruthy();
  expect(screen.getByText("Transfers involving Checking")).toBeTruthy();
  expect(screen.getByText("Checking → Cash")).toBeTruthy();
  expect(screen.getByText("-100").className).toContain("amount-expense");
  expect(screen.getByText("Transfers are account movements, not transactions.")).toBeTruthy();
});

it("marks transfers into the filtered account as positive", async () => {
  vi.useFakeTimers();
  mocks.getJSON.mockImplementation((url: string) => Promise.resolve(url.includes("/transfers")
    ? [{ id: 10, date: "2026-07-17", from_account: 2, to_account: 7, from_name: "Cash", to_name: "Checking", amount: 120, currency: "ILS", note: "Deposit" }]
    : []));

  render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(screen.getByText("+120").className).toContain("amount-income");
});

it("ignores an older account transfer response after the filter changes", async () => {
  let resolveChecking!: (rows: Array<Record<string, unknown>>) => void;
  let resolveSavings!: (rows: Array<Record<string, unknown>>) => void;
  mocks.getJSON.mockImplementation((url: string) => {
    if (url === "/api/transfers?account_id=7") {

      return new Promise((resolve) => { resolveChecking = resolve; });
    }
    if (url === "/api/transfers?account_id=8") {

      return new Promise((resolve) => { resolveSavings = resolve; });
    }

    return Promise.resolve([]);
  });

  render(<TransactionsPage />);
  await act(async () => {});
  const accountFilter = screen.getAllByText("Account", { selector: "label" })[1]?.parentElement?.querySelector("select");
  expect(accountFilter).toBeTruthy();
  fireEvent.change(accountFilter!, { target: { value: "8" } });
  await act(async () => {});

  await act(async () => { resolveSavings([{ id: 9, date: "2026-07-16", from_account: 8, to_account: 2, from_name: "Savings", to_name: "Cash", amount: 50, currency: "ILS", note: "Top up" }]); });
  await act(async () => { resolveChecking([{ id: 8, date: "2026-07-15", from_account: 7, to_account: 2, from_name: "Checking", to_name: "Cash", amount: 100, currency: "ILS", note: "ATM" }]); });

  expect(screen.getByText("Transfers involving Savings")).toBeTruthy();
  expect(screen.getByText("Savings → Cash")).toBeTruthy();
  expect(screen.queryByText("Checking → Cash")).toBeNull();
});

it("passes the selected transaction date range to the transfer context", async () => {
  vi.useFakeTimers();
  mocks.search = "account_id=7&from=2026-07-01&to=2026-07-31";
  mocks.getJSON.mockResolvedValue([]);

  render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(mocks.getJSON).toHaveBeenCalledWith("/api/transfers?account_id=7&from=2026-07-01&to=2026-07-31");
});
