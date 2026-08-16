import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: { prepare: vi.fn() } }));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));

const { snapshotConversion } = await import("../lib/fx-historical.ts");

afterEach(() => vi.restoreAllMocks());

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
});
