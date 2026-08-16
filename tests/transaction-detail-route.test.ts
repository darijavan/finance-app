import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  snapshotConversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx-historical", () => ({ snapshotConversion: mocks.snapshotConversion }));

const route = await import("../app/api/transactions/[id]/route");

function request(method: string, body?: unknown) {

  return new NextRequest("http://localhost/api/transactions/7", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const params = { params: Promise.resolve({ id: "7" }) };

afterEach(() => {
  vi.clearAllMocks();
});

describe("transaction detail route", () => {
  it("locks subscription-generated transactions against edits and deletion", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 7, subscription_id: 3 }) });

    const edited = await route.PUT(request("PUT", { note: "manual" }), params);
    const deleted = await route.DELETE(request("DELETE"), params);

    expect(edited.status).toBe(409);
    expect(await edited.json()).toEqual({ error: "subscription charges are read-only" });
    expect(deleted.status).toBe(409);
    expect(await deleted.json()).toEqual({ error: "subscription charges are read-only" });
  });

  it("recalculates an edited account snapshot from the transaction date", async () => {
    const update = vi.fn();
    const updated = { id: 7, amount: 20, currency: "ILS", account_amount: 6.4, account_currency: "USD" };
    let transactionReads = 0;
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT * FROM transactions")) {

        return { get: () => transactionReads++ === 0
          ? { id: 7, amount: 10, currency: "ILS", date: "2026-08-01", account_id: 2, category_id: null, direction: "expense", subscription_id: null }
          : updated };
      }
      if (sql.includes("SELECT currency FROM accounts")) {

        return { get: () => ({ currency: "USD" }) };
      }
      if (sql.startsWith("UPDATE transactions")) {

        return { run: update };
      }
      if (sql.startsWith("SELECT * FROM transactions WHERE id")) {

        return { get: () => updated };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });
    mocks.snapshotConversion.mockResolvedValue({ amount: 6.4, rate: 0.32, rate_date: "2026-08-20", source: "frankfurter" });

    const response = await route.PUT(request("PUT", { amount: 20, date: "2026-08-20" }), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(updated);
    expect(mocks.snapshotConversion).toHaveBeenCalledWith(20, "ILS", "USD", "2026-08-20");
    expect(update).toHaveBeenCalledWith(20, "ILS", 2, "2026-08-20", 6.4, "USD", 0.32, "2026-08-20", "frankfurter", 7);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transaction", "update", 7, "Updated transaction #7 (amount=?, currency=?, account_id=?, date=?, account_amount=?, account_currency=?, account_fx_rate=?, account_fx_date=?, account_fx_source=?)", undefined);
  });
});
