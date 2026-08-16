import { afterEach, describe, expect, it, vi } from "vitest";
import { catColor, catName, currentMonth, fmtCur, getJSON, monthList, sendJSON } from "../lib/client.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("client helpers", () => {
  it("sends JSON only when a body was supplied and exposes response errors", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response("no", { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    await expect(sendJSON("/api/items", "POST", { name: "Cash" })).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[0]).toEqual(["/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Cash" }) }]);
    await expect(getJSON("/api/no")).rejects.toThrow("no");
    await expect(sendJSON("/api/items", "DELETE")).resolves.toEqual({ ok: true });
    expect(fetch.mock.calls[2]).toEqual(["/api/items", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: undefined }]);
  });

  it("formats native currency and resolves category fallbacks", () => {
    expect(fmtCur(12.5, "ILS")).toMatch(/^₪12[.,]5$/);
    expect(catName([{ id: 2, name: "Food", color: "#f00", direction: "expense" }], 2, "expense")).toBe("Food");
    expect(catName([], 4, "income")).toBe("Income");
    expect(catColor([], 4)).toBe("#888");
  });

  it("builds the current month and twelve descending options", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));

    expect(currentMonth()).toBe("2026-08");
    expect(monthList()).toHaveLength(12);
    expect(monthList()).toEqual(expect.arrayContaining(["2026-08", "2025-09"]));
  });
});
