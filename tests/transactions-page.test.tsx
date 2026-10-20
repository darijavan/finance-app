// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJSON: vi.fn(),
  context: {
    month: "2026-08",
    settings: { currency: "ILS", currency_symbol: "₪" },
    categories: [], accounts: [], transactions: [], expenseCats: [], incomeCats: [],
    reloadKey: 0, reload: vi.fn(), notify: vi.fn(), confirm: vi.fn(), undo: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("q=rent") }));
vi.mock("../app/(finance)/store", () => ({ useFinance: () => mocks.context }));
vi.mock("@/lib/client", () => ({
  API: "/api", getJSON: mocks.getJSON, sendJSON: vi.fn(), fmtCur: (amount: number) => String(amount),
  catName: () => "Other", catColor: () => "#888", CURRENCIES: [],
}));

const { default: TransactionsPage } = await import("../app/(finance)/transactions/page");

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
  mocks.context.reloadKey = 0;
});

it("re-fetches active all-month filters after the provider reloads", async () => {
  vi.useFakeTimers();
  mocks.getJSON.mockResolvedValue([]);
  const view = render(<TransactionsPage />);

  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(mocks.getJSON).toHaveBeenCalledTimes(1);
  expect(mocks.getJSON).toHaveBeenLastCalledWith("/api/transactions?q=rent&from=2026-08-01&to=2026-08-31");

  mocks.context.reloadKey = 1;
  view.rerender(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  expect(mocks.getJSON).toHaveBeenCalledTimes(2);
});

it.each([51951.7, 0, null])("shows recorded account amount %s as a placeholder without filling the correction", async (accountAmount) => {
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  Element.prototype.scrollIntoView = vi.fn();
  mocks.getJSON.mockResolvedValue([{
    id: 42, amount: 10, currency: "USD", direction: "expense", date: "2026-08-10",
    account_id: 1, account_amount: accountAmount, account_currency: "MGA", reimbursable: false,
  }]);
  const view = render(<TransactionsPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(250); });
  fireEvent.click(screen.getByRole("button", { name: "Edit transaction of 2026-08-10" }));

  const input = screen.getByLabelText("Corrected posted debit (account currency)") as HTMLInputElement;
  expect(input.placeholder).toBe(accountAmount == null ? "Leave blank to keep current snapshot" : String(accountAmount));
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { value: "52030" } });
  expect(input.value).toBe("52030");
  fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit transaction of 2026-08-10" }));
  expect((screen.getByLabelText("Corrected posted debit (account currency)") as HTMLInputElement).value).toBe("");
  view.unmount();
  vi.unstubAllGlobals();
});

it("offers PDF files by extension when creating a transaction", () => {
  render(<TransactionsPage />);

  const receipt = screen.getByLabelText("Receipt (PDF or image)") as HTMLInputElement;
  expect(receipt.accept).toContain(".pdf");
});
