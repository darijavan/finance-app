// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
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

it("offers PDF files by extension when creating a transaction", () => {
  render(<TransactionsPage />);

  const receipt = screen.getByLabelText("Receipt (PDF or image)") as HTMLInputElement;
  expect(receipt.accept).toContain(".pdf");
});
