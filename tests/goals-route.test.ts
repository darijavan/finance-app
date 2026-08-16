import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));

const goals = await import("../app/api/goals/route");
const goal = await import("../app/api/goals/[id]/route");

function request(method: string, body?: unknown) {

  return new NextRequest("http://localhost/api/goals", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/goals", () => {
  it("returns linked-account goals with native ledger progress", async () => {
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("FROM goals")) {

        return { all: () => [{ id: 5, account_id: 1, name: "Emergency", target_amount: 1000 }] };
      }
      if (sql.includes("FROM transactions")) {

        return { all: () => [{ account_id: 1, amount: 120, account_amount: 120, direction: "income" }] };
      }

      return { all: () => [{ from_account: 1, to_account: 2, amount: 20, from_amount: 20, to_amount: 20 }] };
    });

    const response = await goals.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 5, account_id: 1, name: "Emergency", target_amount: 1000, current: 100 }]);
  });

  it("rejects a malformed target date at the request boundary", async () => {
    const response = await goals.POST(request("POST", { name: "Emergency", target_amount: 1000, account_id: 1, target_date: "2026-2-3" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid target date" });
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("persists a valid goal after confirming its account exists", async () => {
    const insert = vi.fn(() => ({ lastInsertRowid: 5 }));
    mocks.db.prepare.mockImplementation((sql: string) => sql.startsWith("SELECT 1")
      ? { get: () => ({ 1: 1 }) }
      : { run: insert });

    const response = await goals.POST(request("POST", {
      name: " Emergency ", target_amount: 1000, account_id: 1, target_date: "2026-12-31", note: "Six months",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 5 });
    expect(insert).toHaveBeenCalledWith("Emergency", 1000, 1, "2026-12-31", "Six months", expect.any(String));
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "goal", "create", 5, "Added savings goal \"Emergency\" (1000)");
  });
});

describe("PUT /api/goals/[id]", () => {
  it("rejects an invalid target amount at the request boundary", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 5, name: "Emergency", target_amount: 1000, account_id: 1, target_date: null, note: "" }) });

    const response = await goal.PUT(request("PUT", { target_amount: 0 }), { params: Promise.resolve({ id: "5" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid field value" });
  });

  it("updates supplied fields while retaining the existing goal fields", async () => {
    const update = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => sql.startsWith("SELECT")
      ? { get: () => ({ id: 5, name: "Emergency", target_amount: 1000, account_id: 1, target_date: null, note: "Old" }) }
      : { run: update });

    const response = await goal.PUT(request("PUT", { name: "Bigger emergency", target_amount: 1500, note: "New" }), { params: Promise.resolve({ id: "5" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith("Bigger emergency", 1500, 1, null, "New", 5);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "goal", "update", 5, "Updated savings goal #5 (\"Bigger emergency\")");
  });
});

describe("DELETE /api/goals/[id]", () => {
  it("deletes an existing goal and returns its undo log id", async () => {
    const remove = vi.fn();
    mocks.logActivity.mockReturnValue(31);
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 5, name: "Emergency", target_amount: 1000 }), run: remove });

    const response = await goal.DELETE(request("DELETE"), { params: Promise.resolve({ id: "5" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, log_id: 31 });
    expect(remove).toHaveBeenCalledWith(5);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "goal", "delete", 5, "Deleted savings goal #5 (\"Emergency\", target 1000)", { table: "goals", id: 5, name: "Emergency", target_amount: 1000 });
  });
});
