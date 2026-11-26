import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: { prepare: vi.fn() } }));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));

const { dailyBaseConverter, snapshotConversion } = await import("../lib/fx-historical.ts");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("snapshotConversion", () => {
  it("uses a cached dated quote without fetching", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ rate: 3.0464, rate_date: "2026-07-20", source: "frankfurter" }) });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(snapshotConversion(11.99, "USD", "ILS", "2026-07-21"))
      .resolves.toEqual({ amount: 36.53, rate: 3.0464, rate_date: "2026-07-20", source: "frankfurter" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("persists the provider's actual quote date after a cache miss", async () => {
    const run = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => (
      sql.startsWith("SELECT") ? { get: () => undefined } : { run }
    ));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ date: "2026-07-20", rates: { ILS: 3.0464 } }), { status: 200 })));

    await expect(snapshotConversion(11.99, "USD", "ILS", "2026-07-21"))
      .resolves.toEqual({ amount: 36.53, rate: 3.0464, rate_date: "2026-07-20", source: "frankfurter" });
    expect(run).toHaveBeenCalledWith("2026-07-21", "USD", "ILS", 3.0464, "2026-07-20", "frankfurter", expect.any(String));
  });

  it("falls back to Currency API for dated MGA quotes", async () => {
    const run = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => (
      sql.startsWith("SELECT") ? { get: () => undefined } : { run }
    ));
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "not found" }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ date: "2026-08-28", usd: { mga: 4332.83634349 } }), { status: 200 })));

    await expect(snapshotConversion(11.99, "USD", "MGA", "2026-08-28"))
      .resolves.toEqual({ amount: 51950.71, rate: 4332.83634349, rate_date: "2026-08-28", source: "currency-api" });
    expect(run).toHaveBeenCalledWith("2026-08-28", "USD", "MGA", 4332.83634349, "2026-08-28", "currency-api", expect.any(String));
  });
});

describe("dailyBaseConverter", () => {
  it("converts at each pair's dated rate and falls back to today's rate for future dates and failed lookups", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));
    const get = vi.fn((date: string) => date === "2026-07-21" ? { rate: 3, rate_date: "2026-07-21", source: "frankfurter" } : undefined);
    mocks.db.prepare.mockReturnValue({ get });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    const today = (amount: number) => amount * 4;

    const toBaseAt = await dailyBaseConverter("ILS", today, [
      { currency: "USD", date: "2026-07-21" },
      { currency: "USD", date: "2026-07-21" },
      { currency: "USD", date: "2026-07-22" },
      { currency: "USD", date: "2026-09-01" },
      { currency: "ILS", date: "2026-07-21" },
    ]);

    expect(toBaseAt(10, "USD", "2026-07-21")).toBe(30);
    expect(toBaseAt(10, "USD", "2026-07-22")).toBe(40); // lookup failed
    expect(toBaseAt(10, "USD", "2026-09-01")).toBe(40); // future: no quote yet
    expect(toBaseAt(10, "ILS", "2026-07-21")).toBe(10);
    expect(toBaseAt(10, null, "2026-07-21")).toBe(10);
    expect(get).toHaveBeenCalledTimes(2); // duplicate pair and base/future pairs skip the lookup
  });
});
