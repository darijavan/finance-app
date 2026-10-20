// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendJSON: vi.fn().mockResolvedValue({}),
  context: {
    month: "2026-08", sym: "₪",
    categories: [{ id: 1, name: "Food", direction: "expense", color: "#ff7c7c" }],
    budgets: [], expenseCats: [], reload: vi.fn(), reloadCategories: vi.fn(), notify: vi.fn(), confirm: vi.fn(), undo: vi.fn(),
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
