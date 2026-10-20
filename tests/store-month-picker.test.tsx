// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: "month=2026-07",
  replace: vi.fn(),
  getJSON: vi.fn((url: string) => Promise.resolve(url.endsWith("/settings")
    ? { currency: "ILS", currency_symbol: "₪" }
    : [])),
}));

vi.mock("next/link", () => ({ default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/transactions",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("@/lib/client", () => ({
  API: "/api",
  CURRENCIES: [{ code: "ILS", symbol: "₪" }],
  currentMonth: () => "2026-10",
  getJSON: mocks.getJSON,
  monthList: () => ["2026-07", "2026-08", "2026-09"],
  sendJSON: vi.fn(),
}));

const { default: FinanceProvider } = await import("../app/(finance)/store");

afterEach(() => {
  cleanup();
  mocks.search = "month=2026-07";
  vi.clearAllMocks();
});

it("shows a selected month immediately and later follows external URL navigation", async () => {
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<FinanceProvider><div>Content</div></FinanceProvider>);
  });
  const picker = screen.getByLabelText("Month") as HTMLSelectElement;

  fireEvent.change(picker, { target: { value: "2026-08" } });
  expect(picker.value).toBe("2026-08");
  expect(mocks.replace).toHaveBeenCalledWith("/transactions?month=2026-08");

  mocks.search = "month=2026-09";
  view.rerender(<FinanceProvider><div>Content</div></FinanceProvider>);
  expect(picker.value).toBe("2026-09");
});
