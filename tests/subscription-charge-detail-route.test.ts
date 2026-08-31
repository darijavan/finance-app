import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));

const { PUT } = await import("../app/api/subscriptions/charge/[id]/route");

afterEach(() => vi.clearAllMocks());

describe("PUT /api/subscriptions/charge/:id", () => {
  it("corrects only the subscription charge's account snapshot", async () => {
    const run = vi.fn();
    const before = { id: 132, amount: 11.99, date: "2026-08-28", account_id: 7, account_amount: 51951.7, account_currency: "MGA" };
    const after = { ...before, account_amount: 52030, account_fx_rate: 52030 / 11.99, account_fx_date: "2026-08-28", account_fx_source: "provider_statement" };
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT * FROM transactions WHERE id=? AND")) {

        return { get: () => before };
      }
      if (sql === "SELECT currency FROM accounts WHERE id=?") {

        return { get: () => ({ currency: "MGA" }) };
      }
      if (sql.startsWith("UPDATE transactions")) {

        return { run };
      }

      return { get: () => after };
    });

    const response = await PUT(new NextRequest("http://localhost/api/subscriptions/charge/132", {
      method: "PUT", body: JSON.stringify({ posted_account_amount: 52030 }), headers: { "content-type": "application/json" },
    }), { params: Promise.resolve({ id: "132" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(after);
    expect(run).toHaveBeenCalledWith(52030, "MGA", 52030 / 11.99, "2026-08-28", "provider_statement", 132);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transaction", "update", 132,
      "Corrected subscription charge #132 posted debit from 51951.7 MGA to 52030 MGA", expect.objectContaining({ posted_account_amount: 52030 }));
  });
});
