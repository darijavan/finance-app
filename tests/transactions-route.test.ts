import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  snapshotConversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx-historical", () => ({ snapshotConversion: mocks.snapshotConversion }));

const { POST } = await import("../app/api/transactions/route");

function request(body: unknown) {
  return new NextRequest("http://localhost/api/transactions", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}

describe("POST /api/transactions", () => {
  it("rejects invalid monetary and account input", async () => {
    const amount = await POST(request({ amount: 0, currency: "ILS" }));
    const account = await POST(request({ amount: 12, currency: "ILS", account_id: "bad" }));

    expect(amount.status).toBe(400);
    expect(account.status).toBe(400);
  });

  it("records an immutable account-currency snapshot and activity", async () => {
    const insert = vi.fn(() => ({ lastInsertRowid: 14 }));
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT currency FROM accounts")) return { get: () => ({ currency: "USD" }) };
      if (sql.startsWith("INSERT")) return { run: insert };

      return { get: () => ({ id: 14, amount: 25 }) };
    });
    mocks.snapshotConversion.mockResolvedValue({ amount: 7.9, rate: 0.316, rate_date: "2026-08-10", source: "frankfurter" });

    const response = await POST(request({ amount: 25, direction: "expense", category_id: 4, account_id: 2, date: "2026-08-10", note: "Groceries", currency: "ILS", reimbursable: true }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(25, "ILS", "expense", 4, "2026-08-10", "Groceries", 2, 1, 7.9, "USD", 0.316, "2026-08-10", "frankfurter", expect.any(String));
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transaction", "create", 14, "Added expense 25 ILS (Groceries) for 2026-08-10");
  });
});
