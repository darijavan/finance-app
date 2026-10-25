// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Budget } from "../lib/types";

const mocks = vi.hoisted(() => ({
  sendJSON: vi.fn().mockResolvedValue({}),
  context: {
    month: "2026-08", sym: "₪",
    categories: [{ id: 1, name: "Food", direction: "expense", color: "#ff7c7c" }],
    budgets: [] as Budget[], expenseCats: [], reload: vi.fn(), reloadCategories: vi.fn(), notify: vi.fn(), confirm: vi.fn(), undo: vi.fn(),
  },
}));

vi.mock("../app/(finance)/store", () => ({ useFinance: () => mocks.context }));
vi.mock("@/lib/client", () => ({ API: "/api", sendJSON: mocks.sendJSON, fmt: (amount: number) => String(amount) }));
vi.mock("@/lib/sort", () => ({
  useSort: () => null, useSorted: <T,>(rows: T[]) => rows, SortHeader: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
}));

const { default: BudgetsPage } = await import("../app/(finance)/budgets/page");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mocks.context.budgets = [];
});

it("creates a repeating budget with a native checkbox", async () => {
  render(<BudgetsPage />);
  const repeat = screen.getByRole("checkbox", { name: "Repeat every month" });

  expect(repeat).toHaveProperty("type", "checkbox");
  fireEvent.change(screen.getByLabelText("Budget (₪)"), { target: { value: "400" } });
  fireEvent.click(repeat);
  fireEvent.click(screen.getByRole("button", { name: "Save for 2026-08" }));

  await vi.waitFor(() => expect(mocks.sendJSON).toHaveBeenCalledWith("/api/budgets", "PUT", {
    month: "2026-08", category_id: null, amount: 400, rollover: false, recurring: true,
  }));
});

it("shows recurring budgets and allows repetition to be stopped via edit", async () => {
  mocks.context.budgets = [{ id: 3, category_id: null, month: "2026-08", amount: 400, recurring: 1 }];
  render(<BudgetsPage />);

  expect(screen.getByText(/repeats monthly/)).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Edit overall budget"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Repeat every month" }));
  fireEvent.click(screen.getByRole("button", { name: "Update" }));

  await vi.waitFor(() => expect(mocks.sendJSON).toHaveBeenCalledWith("/api/budgets", "PUT", expect.objectContaining({ recurring: false })));
});

it("refreshes categories immediately after updating a category", async () => {
  render(<BudgetsPage />);
  fireEvent.click(screen.getByLabelText("Edit category Food"));
  fireEvent.click(screen.getByRole("button", { name: "Update" }));

  await vi.waitFor(() => expect(mocks.context.reloadCategories).toHaveBeenCalledOnce());
});

it("saves the selected native color for an edited category", async () => {
  render(<BudgetsPage />);
  fireEvent.click(screen.getByLabelText("Edit category Food"));
  const color = screen.getByLabelText("Tag color") as HTMLInputElement;

  expect(color.type).toBe("color");
  expect(color.value).toBe("#ff7c7c");

  fireEvent.change(color, { target: { value: "#123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Update" }));

  await vi.waitFor(() => expect(mocks.sendJSON).toHaveBeenCalledWith("/api/categories/1", "PUT", {
    name: "Food", direction: "expense", color: "#123456",
  }));
});
