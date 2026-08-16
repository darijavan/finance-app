import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: { prepare: vi.fn(), exec: vi.fn() } }));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));

const { getBaseCurrency, getConverter, refreshRates } = await import("../lib/fx.ts");

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function rates(rows: unknown[], base = "ILS") {
  mocks.db.prepare.mockImplementation((sql: string) => {
    if (sql.includes("FROM settings")) return { get: () => ({ value: base }) };
    if (sql.includes("FROM fx_rates")) return { all: () => rows };

    return { run: vi.fn() };
  });
}

describe("FX cache and conversion", () => {
  it("uses fresh base-relative cached rates without an HTTP request", async () => {
    rates([{ code: "ILS", rate: 1, updated_at: new Date().toISOString() }, { code: "USD", rate: 3.2, updated_at: new Date().toISOString() }]);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    await expect(refreshRates()).resolves.toEqual({ ILS: 1, USD: 3.2 });
    expect(fetch).not.toHaveBeenCalled();
    expect(getBaseCurrency()).toBe("ILS");
  });

  it("refreshes an incompatible cache and persists a rate of one for the new base", async () => {
    rates([{ code: "ILS", rate: 1, updated_at: new Date().toISOString() }], "USD");
    const run = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("FROM settings")) return { get: () => ({ value: "USD" }) };
      if (sql.includes("FROM fx_rates")) return { all: () => [{ code: "ILS", rate: 1, updated_at: new Date().toISOString() }] };

      return { run };
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ result: "success", rates: { ILS: 3.2 } }), { status: 200 })));

    await expect(refreshRates()).resolves.toEqual({ ILS: 3.2 });
    expect(mocks.db.exec).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(run).toHaveBeenCalledWith("USD", 1, expect.any(String));
    expect(mocks.db.exec).toHaveBeenNthCalledWith(2, "COMMIT");
  });

  it("falls back to cached rates and converts unknown currencies as base amounts", async () => {
    rates([{ code: "ILS", rate: 1, updated_at: "2000-01-01T00:00:00.000Z" }, { code: "USD", rate: 3.2, updated_at: "2000-01-01T00:00:00.000Z" }]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const converter = await getConverter();
    expect(converter.toBase(32, "USD")).toBe(10);
    expect(converter.toBase(32, "EUR")).toBe(32);
  });
});
