// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendJSON: vi.fn().mockResolvedValue({ ok: true }),
  context: {
    settings: { currency: "ILS", currency_symbol: "₪" },
    accounts: [{ id: 1, name: "Savings", type: "bank", currency: "ILS", balance: 250, base_balance: 250 }],
    transfers: [], goals: [], reload: vi.fn(), notify: vi.fn(), confirm: vi.fn(), undo: vi.fn(),
  },
}));

vi.mock("../app/(finance)/store", () => ({ useFinance: () => mocks.context }));
vi.mock("@/lib/client", () => ({
  API: "/api", sendJSON: mocks.sendJSON, fmt: (amount: number) => String(amount),
  fmtCur: (amount: number, currency: string) => `${currency} ${amount}`,
  CURRENCIES: [{ code: "ILS", symbol: "₪" }],
}));

const { default: AccountsPage } = await import("../app/(finance)/accounts/page");

afterEach(() => {
  cleanup();
  mocks.context.accounts = [{ id: 1, name: "Savings", type: "bank", currency: "ILS", balance: 250, base_balance: 250 }];
  vi.clearAllMocks();
});

it("reloads shared goals after creating a savings goal", async () => {
  render(<AccountsPage />);
  const goalsPanel = screen.getByRole("heading", { name: "Savings goals" }).parentElement!;
  fireEvent.change(goalsPanel.querySelector('input[placeholder="Emergency fund…"]')!, { target: { value: "Emergency fund" } });
  fireEvent.change(goalsPanel.querySelector('input[placeholder="0.00"]')!, { target: { value: "1000" } });
  fireEvent.change(goalsPanel.querySelector("select")!, { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Add goal" }));

  await vi.waitFor(() => expect(mocks.context.reload).toHaveBeenCalledOnce());
});

it("drops optimistic account order when refreshed accounts have the same count", async () => {
  mocks.context.accounts = [
    { id: 1, name: "Checking", type: "bank", currency: "ILS", balance: 100, base_balance: 100 },
    { id: 2, name: "Cash", type: "cash", currency: "ILS", balance: 50, base_balance: 50 },
  ];
  const view = render(<AccountsPage />);
  const checking = screen.getByRole("button", { name: "Delete account Checking" }).closest(".account-card")!;
  const cash = screen.getByRole("button", { name: "Delete account Cash" }).closest(".account-card")!;
  fireEvent.dragStart(checking, { dataTransfer: { effectAllowed: "none" } });
  fireEvent.drop(cash);
  expect([...document.querySelectorAll(".account-card .label")].map((node) => node.textContent)).toEqual(["Cash (cash)", "Checking (bank)"]);

  mocks.context.accounts = [
    { id: 3, name: "Brokerage", type: "other", currency: "ILS", balance: 80, base_balance: 80 },
    { id: 4, name: "Wallet", type: "cash", currency: "ILS", balance: 20, base_balance: 20 },
  ];
  view.rerender(<AccountsPage />);

  expect([...document.querySelectorAll(".account-card .label")].map((node) => node.textContent)).toEqual(["Brokerage (other)", "Wallet (cash)"]);
  await vi.waitFor(() => expect(mocks.sendJSON).toHaveBeenCalledWith("/api/accounts/reorder", "POST", { ids: [2, 1] }));
});

it("uses fresh server order after an optimistic reorder", () => {
  mocks.context.accounts = [
    { id: 1, name: "Checking", type: "bank", currency: "ILS", balance: 100, base_balance: 100 },
    { id: 2, name: "Cash", type: "cash", currency: "ILS", balance: 50, base_balance: 50 },
  ];
  const view = render(<AccountsPage />);
  fireEvent.dragStart(screen.getByRole("button", { name: "Delete account Checking" }).closest(".account-card")!, { dataTransfer: { effectAllowed: "none" } });
  fireEvent.drop(screen.getByRole("button", { name: "Delete account Cash" }).closest(".account-card")!);

  mocks.context.accounts = [...mocks.context.accounts];
  view.rerender(<AccountsPage />);

  expect([...document.querySelectorAll(".account-card .label")].map((node) => node.textContent)).toEqual(["Checking (bank)", "Cash (cash)"]);
});
