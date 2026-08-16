import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));

const { POST } = await import("../app/api/transactions/[id]/reimburse/route");

function call(id = "5") {
  return POST(new NextRequest("http://localhost/api/transactions/5/reimburse", { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("POST /api/transactions/:id/reimburse", () => {
  it.each([
    [undefined, 404, "transaction not found"],
    [{ reimbursable: 1, reimbursed_at: null, subscription_id: 9 }, 409, "subscription charges are read-only"],
    [{ reimbursable: 0, reimbursed_at: null, subscription_id: null }, 409, "transaction is not reimbursable"],
    [{ reimbursable: 1, reimbursed_at: "2026-08-01", subscription_id: null }, 409, "transaction is already reimbursed"],
  ])("rejects invalid reimbursement state", async (transaction, status, error) => {
    mocks.db.prepare.mockReturnValue({ get: () => transaction });

    const response = await call();

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });

  it("marks an eligible manual transaction reimbursed and logs it", async () => {
    const run = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => (
      sql.startsWith("SELECT") ? { get: () => ({ reimbursable: 1, reimbursed_at: null, subscription_id: null }) } : { run }
    ));

    const response = await call();
    const result = await response.json() as { ok: boolean; reimbursed_at: string };

    expect(response.status).toBe(200);
    expect(result.ok).toBe(true);
    expect(result.reimbursed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(run).toHaveBeenCalledWith(result.reimbursed_at, 5);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "transaction", "update", 5, "Marked transaction #5 reimbursed");
  });
});
