import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn(), exec: vi.fn() },
  logActivity: vi.fn(),
  snapshotConversion: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx-historical", () => ({ snapshotConversion: mocks.snapshotConversion }));

const { POST } = await import("../app/api/subscriptions/charge/route");

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("POST /api/subscriptions/charge", () => {
  it("rejects malformed requested months", async () => {
    const response = await POST(new NextRequest("http://localhost/api/subscriptions/charge?month=August", { method: "POST" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "month must be YYYY-MM" });
  });

  it("charges only a newly inserted due subscription and logs its name", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00"));
    const insert = vi.fn(() => ({ changes: 1 }));
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql === "SELECT * FROM subscriptions WHERE active=1") {
        return { all: () => [{ id: 3, name: "Music", active: 1, amount: 20, currency: "ILS", direction: "expense", category_id: 2, day_of_month: 10, frequency: "monthly", start_date: null, account_id: null }] };
      }
      if (sql.includes("SELECT 1 FROM transactions")) return { get: () => undefined };
      if (sql.startsWith("INSERT OR IGNORE")) return { run: insert };

      return { get: () => undefined };
    });

    const response = await POST(new NextRequest("http://localhost/api/subscriptions/charge?month=2026-08", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 1 });
    expect(insert).toHaveBeenCalledWith(20, "ILS", "expense", 2, "2026-08-10", "[auto] Music (monthly)", null, 3, null, null, null, null, null, expect.any(String));
    expect(mocks.db.exec).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(mocks.db.exec).toHaveBeenNthCalledWith(2, "COMMIT");
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transaction", "create", null, "Charged Music for 2026-08");
  });
});
