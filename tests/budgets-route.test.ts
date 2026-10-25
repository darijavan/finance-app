import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
  materializeRecurringBudgets: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/budgets", () => ({ materializeRecurringBudgets: mocks.materializeRecurringBudgets }));

const budgets = await import("../app/api/budgets/route");
const budget = await import("../app/api/budgets/[id]/route");

function request(method: string, body?: unknown) {

  return new NextRequest("http://localhost/api/budgets", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/budgets", () => {
  it("returns budgets for the requested month", async () => {
    const rows = [{ id: 3, month: "2026-05", amount: 400, category_name: "Food" }];
    const all = vi.fn(() => rows);
    mocks.db.prepare.mockReturnValue({ all });

    const response = await budgets.GET(new NextRequest("http://localhost/api/budgets?month=2026-05"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
    expect(mocks.materializeRecurringBudgets).toHaveBeenCalledWith(mocks.db, "2026-05");
    expect(all).toHaveBeenCalledWith("2026-05");
  });

  it("rejects an invalid recurring value", async () => {
    const response = await budgets.PUT(request("PUT", { month: "2026-05", amount: 400, recurring: "yes" }));

    expect(response.status).toBe(400);
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("rejects an invalid supplied month", async () => {
    const response = await budgets.PUT(request("PUT", { month: "2026-13", amount: 400, recurring: false }));

    expect(response.status).toBe(400);
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("rejects a non-numeric budget amount at the request boundary", async () => {
    const response = await budgets.PUT(request("PUT", { month: "2026-05", category_id: 2, amount: "free" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "valid amount and category required" });
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("replaces the month category budget and records its creation", async () => {
    const remove = vi.fn();
    const insert = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT recurring")) {

        return { get: () => undefined };
      }
      if (sql.startsWith("DELETE FROM budgets WHERE month")) {

        return { run: remove };
      }
      if (sql.startsWith("INSERT INTO budgets")) {

        return { run: insert };
      }

      return { get: () => ({ id: 21 }) };
    });

    const response = await budgets.PUT(request("PUT", { month: "2026-05", category_id: 2, amount: 400, rollover: true, recurring: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith("2026-05", 2, 2);
    expect(insert).toHaveBeenCalledWith(2, "2026-05", 400, 1, 1, "2026-05");
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "budget", "create", 21, "Set category #2 budget for 2026-05 = 400");
  });

  it("retains recurrence lineage when editing an instance to stop repeating", async () => {
    const insert = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT recurring")) return { get: () => ({ recurring: 1, recurrence_start: "2026-05" }) };
      if (sql.includes("month>?")) return { run: vi.fn() };
      if (sql.startsWith("DELETE FROM budgets WHERE month")) return { run: vi.fn() };
      if (sql.startsWith("INSERT INTO budgets")) return { run: insert };

      return { get: () => ({ id: 22 }) };
    });

    await budgets.PUT(request("PUT", { month: "2026-07", category_id: 2, amount: 500, recurring: false }));

    expect(insert).toHaveBeenCalledWith(2, "2026-07", 500, 0, 0, "2026-05");
  });
});

describe("DELETE /api/budgets/[id]", () => {
  it("deletes an existing budget and returns its undo log id", async () => {
    const remove = vi.fn();
    mocks.logActivity.mockReturnValue(22);
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 3, amount: 400, month: "2026-05", category_id: 2 }), run: remove });

    const response = await budget.DELETE(request("DELETE"), { params: Promise.resolve({ id: "3" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, log_id: 22 });
    expect(remove).toHaveBeenCalledWith(3);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "budget", "delete", 3, "Deleted budget #3 (400 for 2026-05, category #2)", { table: "budgets", id: 3, amount: 400, month: "2026-05", category_id: 2 });
  });
});
