import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  snapshotConversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx-historical", () => ({ snapshotConversion: mocks.snapshotConversion }));

const { GET, POST } = await import("../app/api/transfers/route");

function request(body: unknown) {

  return new NextRequest("http://localhost/api/transfers", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  });
}

describe("GET /api/transfers", () => {
  it("returns transfers where the filtered account is either endpoint", async () => {
    const all = vi.fn(() => []);
    mocks.db.prepare.mockReturnValue({ all });

    const response = await GET(new NextRequest("http://localhost/api/transfers?account_id=7"));

    expect(response.status).toBe(200);
    expect(mocks.db.prepare).toHaveBeenCalledWith(expect.stringContaining("(t.from_account=? OR t.to_account=?)"));
    expect(all).toHaveBeenCalledWith(7, 7, 50);
  });

  it("applies date boundaries with the account endpoint filter", async () => {
    const all = vi.fn(() => []);
    mocks.db.prepare.mockReturnValue({ all });

    const response = await GET(new NextRequest("http://localhost/api/transfers?account_id=7&from=2026-07-01&to=2026-07-31"));

    expect(response.status).toBe(200);
    expect(mocks.db.prepare).toHaveBeenCalledWith(expect.stringContaining("t.date>=? AND t.date<=? AND (t.from_account=? OR t.to_account=?)"));
    expect(all).toHaveBeenCalledWith("2026-07-01", "2026-07-31", 7, 7, 50);
  });
});

describe("POST /api/transfers", () => {
  it("rejects zero amounts and transfers to the same account", async () => {
    const zero = await POST(request({ amount: 0, from_account: 1, to_account: 2, currency: "ILS" }));
    const sameAccount = await POST(request({ amount: 1, from_account: 1, to_account: 1, currency: "ILS" }));

    expect(zero.status).toBe(400);
    expect(sameAccount.status).toBe(400);
  });

  it("stores separate immutable debit and credit snapshots", async () => {
    const insert = vi.fn(() => ({ lastInsertRowid: 11 }));
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("SELECT currency FROM accounts")) {

        return { get: (id: number) => ({ currency: id === 1 ? "ILS" : "USD" }) };
      }
      if (sql.startsWith("INSERT"))

      return { run: insert };

      return { get: () => ({ id: 11 }) };
    });
    mocks.snapshotConversion.mockResolvedValueOnce({ amount: 100, rate: 1, rate_date: "2026-08-10", source: "identity" })
      .mockResolvedValueOnce({ amount: 31.5, rate: 0.315, rate_date: "2026-08-10", source: "frankfurter" });

    const response = await POST(request({ amount: 100, from_account: 1, to_account: 2, date: "2026-08-10", note: "Top up", currency: "ILS" }));

    expect(response.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(100, "ILS", 1, 2, "2026-08-10", "Top up", 100, "ILS", 31.5, "USD", 1, 0.315, "2026-08-10|2026-08-10", "identity|frankfurter", expect.any(String));
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transfer", "create", 11, "Transferred 100 ILS → 31.5 USD on 2026-08-10");
  });
});
