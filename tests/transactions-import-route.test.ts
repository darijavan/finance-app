import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  snapshotConversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx-historical", () => ({ snapshotConversion: mocks.snapshotConversion }));

const { POST } = await import("../app/api/transactions/import/route");

function request(body: unknown) {
  return new NextRequest("http://localhost/api/transactions/import", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/transactions/import", () => {
  it("rejects an empty import before writing", async () => {
    const response = await POST(request({ rows: [], currency: "ILS" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "rows required" });
  });

  it("imports valid rows, skips exact duplicates, and records account snapshots", async () => {
    const duplicate = vi.fn((_: string, __: number, ___: string, note: string) => note === "Already there");
    const insert = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT currency FROM accounts")) return { get: () => ({ currency: "USD" }) };
      if (sql.includes("SELECT 1 FROM transactions")) return { get: duplicate };

      return { run: insert };
    });
    mocks.snapshotConversion.mockResolvedValue({ amount: 3.2, rate: 0.32, rate_date: "2026-08-10", source: "frankfurter" });

    const response = await POST(request({
      currency: "ILS",
      account_id: 7,
      category_id: 3,
      rows: [
        { date: "2026-08-10", amount: 10, direction: "expense", note: "Groceries" },
        { date: "2026-08-10", amount: 10, direction: "expense", note: "Already there" },
        { date: "not-a-date", amount: 2, direction: "income", note: "Bad" },
      ],
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 1, skipped: 1, invalid: 1 });
    expect(mocks.snapshotConversion).toHaveBeenCalledWith(10, "ILS", "USD", "2026-08-10");
    expect(insert).toHaveBeenCalledWith(10, "ILS", "expense", 3, "2026-08-10", "Groceries", 7, 3.2, "USD", 0.32, "2026-08-10", "frankfurter", expect.any(String));
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transaction", "create", null, "Imported 1 transaction(s) from CSV");
  });
});
