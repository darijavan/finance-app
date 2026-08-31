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
