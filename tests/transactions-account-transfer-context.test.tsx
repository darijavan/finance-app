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
  mocks.context.month = "2026-08";
  vi.clearAllMocks();
  vi.useRealTimers();
});

it("shows account transfers separately from filtered transaction results", async () => {
  vi.useFakeTimers();
  mocks.getJSON.mockImplementation((url: string) => Promise.resolve(url.includes("/transfers")
    ? [{ id: 8, date: "2026-07-15", from_account: 7, to_account: 2, from_name: "Checking", to_name: "Cash", amount: 100, currency: "ILS", from_amount: 120, from_currency: "USD", note: "ATM" }]
    : [{ id: 1, date: "2026-07-16", direction: "expense", amount: 50, currency: "ILS", category_id: null, account_id: 7, reimbursable: false }]));

  render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(mocks.getJSON).toHaveBeenCalledWith("/api/transfers?account_id=7&from=2026-08-01&to=2026-08-31");
  expect(screen.getByText("Search results (1, Aug 1, 2026 to Aug 31, 2026)")).toBeTruthy();
  expect(screen.getByText("Transfers involving Checking")).toBeTruthy();
  expect(screen.getByText("Checking → Cash")).toBeTruthy();
  expect(screen.getByText("-100").className).toContain("amount-expense");
  expect(screen.getAllByText("Account amount")).toHaveLength(2);
  expect(screen.getByText("-120").className).toContain("amount-expense");
  expect(screen.getByText("Transfers are account movements, not transactions.")).toBeTruthy();
});

it("defaults dates to the selected month and follows later month changes", async () => {
  vi.useFakeTimers();
  mocks.search = "";
  mocks.context.month = "2026-08";
  mocks.getJSON.mockResolvedValue([]);

  const view = render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(mocks.getJSON).toHaveBeenCalledWith("/api/transactions?from=2026-08-01&to=2026-08-31");

  mocks.context.month = "2026-07";
  view.rerender(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(mocks.getJSON).toHaveBeenCalledWith("/api/transactions?from=2026-07-01&to=2026-07-31");
});

it("resets explicit date bounds when the month changes", async () => {
  vi.useFakeTimers();
  mocks.search = "from=2026-07-01";
  mocks.context.month = "2026-07";
  mocks.getJSON.mockResolvedValue([]);

  const view = render(<TransactionsPage />);
  const fromInput = screen.getByText("From", { selector: "label" }).parentElement?.querySelector("input");
  const toInput = screen.getByText("To", { selector: "label" }).parentElement?.querySelector("input");
  expect(fromInput).toBeTruthy();
  expect(toInput).toBeTruthy();
  mocks.context.month = "2026-08";
  view.rerender(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect((fromInput as HTMLInputElement).value).toBe("2026-08-01");
  expect((toInput as HTMLInputElement).value).toBe("2026-08-31");
});

it("searches all months when both date bounds are cleared", async () => {
  vi.useFakeTimers();
  mocks.search = "";
  mocks.getJSON.mockResolvedValue([]);

  render(<TransactionsPage />);
  const fromInput = screen.getByText("From", { selector: "label" }).parentElement?.querySelector("input");
  const toInput = screen.getByText("To", { selector: "label" }).parentElement?.querySelector("input");
  expect(fromInput).toBeTruthy();
  expect(toInput).toBeTruthy();
  fireEvent.change(fromInput!, { target: { value: "" } });
  fireEvent.change(toInput!, { target: { value: "" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(mocks.getJSON).toHaveBeenCalledWith("/api/transactions?");
  expect(screen.getByText("Search results (0, all months)")).toBeTruthy();
});

it("describes the selected date range in filtered result headings", async () => {
  vi.useFakeTimers();
  mocks.search = "from=2026-08-01";
  mocks.getJSON.mockResolvedValue([{ id: 1, date: "2026-08-22", direction: "expense", amount: 50, currency: "ILS", category_id: null, account_id: null, reimbursable: false }]);

  render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(screen.getByText("Search & filter — 1 match(es), Aug 1, 2026 to Aug 31, 2026")).toBeTruthy();
  expect(screen.getByText("Search results (1, Aug 1, 2026 to Aug 31, 2026)")).toBeTruthy();
});

it("marks transfers into the filtered account as positive", async () => {
  vi.useFakeTimers();
  mocks.getJSON.mockImplementation((url: string) => Promise.resolve(url.includes("/transfers")
    ? [{ id: 10, date: "2026-07-17", from_account: 2, to_account: 7, from_name: "Cash", to_name: "Checking", amount: 120, currency: "ILS", from_amount: 137, from_currency: "EUR", to_amount: 95, to_currency: "USD", note: "Deposit" }]
    : []));

  render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });

  expect(screen.getByText("+120").className).toContain("amount-income");
  expect(screen.getByText("+137").className).toContain("amount-income");
});

it("ignores an older account transfer response after the filter changes", async () => {
  let resolveChecking!: (rows: Array<Record<string, unknown>>) => void;
  let resolveSavings!: (rows: Array<Record<string, unknown>>) => void;
  mocks.getJSON.mockImplementation((url: string) => {
    if (url === "/api/transfers?account_id=7&from=2026-08-01&to=2026-08-31") {

      return new Promise((resolve) => { resolveChecking = resolve; });
    }
    if (url === "/api/transfers?account_id=8&from=2026-08-01&to=2026-08-31") {

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
