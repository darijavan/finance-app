import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  snapshotConversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx-historical", () => ({ snapshotConversion: mocks.snapshotConversion }));

const route = await import("../app/api/transfers/[id]/route");
const params = { params: Promise.resolve({ id: "8" }) };

function request(body: unknown) {

  return new NextRequest("http://localhost/api/transfers/8", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("transfer detail route", () => {
  it("recalculates both dated account snapshots when a transfer is edited", async () => {
    const update = vi.fn();
    const updated = { id: 8, amount: 200, from_amount: 200, from_currency: "ILS", to_amount: 63, to_currency: "USD" };
    let transferReads = 0;
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT * FROM transfers")) {

        return { get: () => transferReads++ === 0 ? { id: 8 } : updated };
      }
      if (sql.includes("SELECT currency FROM accounts")) {

        return { get: (accountId: number) => ({ currency: accountId === 1 ? "ILS" : "USD" }) };
      }
      if (sql.startsWith("UPDATE transfers")) {

        return { run: update };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });
    mocks.snapshotConversion
      .mockResolvedValueOnce({ amount: 200, rate: 1, rate_date: "2026-08-21", source: "identity" })
      .mockResolvedValueOnce({ amount: 63, rate: 0.315, rate_date: "2026-08-20", source: "frankfurter" });

    const response = await route.PUT(request({ amount: 200, currency: "ILS", from_account: 1, to_account: 2, date: "2026-08-21", note: "Rebalanced" }), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updated);
    expect(mocks.snapshotConversion).toHaveBeenNthCalledWith(1, 200, "ILS", "ILS", "2026-08-21");
    expect(mocks.snapshotConversion).toHaveBeenNthCalledWith(2, 200, "ILS", "USD", "2026-08-21");
    expect(update).toHaveBeenCalledWith(200, "ILS", 1, 2, "2026-08-21", "Rebalanced", 200, "ILS", 63, "USD", 1, 0.315, "2026-08-21|2026-08-20", "identity|frankfurter", 8);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transfer", "update", 8, "Updated transfer #8", undefined);
  });
});
