import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { exec: vi.fn(), prepare: vi.fn() },
  getConverter: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));
vi.mock("@/lib/fx", () => ({ getConverter: mocks.getConverter }));

const accounts = await import("../app/api/accounts/route");
const account = await import("../app/api/accounts/[id]/route");
const reorder = await import("../app/api/accounts/reorder/route");

function request(url: string, method: string, body?: unknown) {

  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/accounts", () => {
  it("rejects an invalid historical month at the request boundary", async () => {
    const response = await accounts.GET(new NextRequest("http://localhost/api/accounts?month=2026-13"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "valid month required" });
    expect(mocks.getConverter).not.toHaveBeenCalled();
  });

  it("returns balances through the requested historical month", async () => {
    mocks.getConverter.mockResolvedValue({ toBase: (amount: number) => amount * 2 });
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT * FROM accounts")) {

        return { all: () => [{ id: 1, currency: "ILS", name: "Bank" }] };
      }
      if (sql.includes("FROM transactions")) {

        return { all: () => [
          { account_id: 1, amount: 100, account_amount: 100, direction: "income", date: "2026-05-10" },
          { account_id: 1, amount: 30, account_amount: 30, direction: "expense", date: "2026-06-01" },
        ] };
      }

      return { all: () => [{ from_account: 1, to_account: 2, amount: 50, from_amount: 50, to_amount: 50, date: "2026-05-20" }] };
    });

    const response = await accounts.GET(new NextRequest("http://localhost/api/accounts?month=2026-05"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: 1, currency: "ILS", name: "Bank", balance: 50, base_balance: 100 }]);
  });

  it("rejects unsupported account currencies before persisting", async () => {
    const response = await accounts.POST(request("http://localhost/api/accounts", "POST", { name: "Wallet", currency: "DOGE" }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "invalid currency code" });
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("persists a valid account and returns its identifier", async () => {
    const insert = vi.fn(() => ({ lastInsertRowid: 8 }));
    mocks.db.prepare.mockReturnValue({ run: insert });

    const response = await accounts.POST(request("http://localhost/api/accounts", "POST", {
      name: "  Cash  ", type: "cash", currency: "ILS", note: "Pocket",
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ ok: true, id: 8 });
    expect(insert).toHaveBeenCalledWith("Cash", "cash", "ILS", "Pocket");
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "account", "create", 8, "Added account \"Cash\" (cash)");
  });
});

describe("DELETE /api/accounts/[id]", () => {
  it("rejects deletion when linked ledger rows exist", async () => {
    mocks.db.prepare.mockImplementation((sql: string) => ({
      get: () => sql.startsWith("SELECT *") ? { id: 4, name: "Card" } : { c: sql.includes("transactions") ? 1 : 0 },
    }));

    const response = await account.DELETE(request("http://localhost/api/accounts/4", "DELETE"), { params: Promise.resolve({ id: "4" }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "Account is in use by transactions, transfers, or subscriptions. Reassign or delete those first." });
  });

  it("deletes an unlinked account and returns its undo log id", async () => {
    const remove = vi.fn();
    mocks.logActivity.mockReturnValue(19);
    mocks.db.prepare.mockImplementation((sql: string) => ({
      get: () => sql.startsWith("SELECT *") ? { id: 4, name: "Card", currency: "ILS" } : { c: 0 },
      run: remove,
    }));

    const response = await account.DELETE(request("http://localhost/api/accounts/4", "DELETE"), { params: Promise.resolve({ id: "4" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, log_id: 19 });
    expect(remove).toHaveBeenCalledWith(4);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "account", "delete", 4, "Deleted account #4 (\"Card\")", { table: "accounts", id: 4, name: "Card", currency: "ILS" });
  });
});

describe("POST /api/accounts/reorder", () => {
  it("rejects a non-integer account order at the request boundary", async () => {
    const response = await reorder.POST(request("http://localhost/api/accounts/reorder", "POST", { ids: [1, "2"] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "ids must be an array of account IDs" });
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("writes the submitted complete account order atomically", async () => {
    const update = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => sql.startsWith("SELECT id")
      ? { all: () => [{ id: 1 }, { id: 2 }] }
      : { run: update });

    const response = await reorder.POST(request("http://localhost/api/accounts/reorder", "POST", { ids: [2, 1] }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(mocks.db.exec).toHaveBeenNthCalledWith(1, "BEGIN IMMEDIATE");
    expect(update).toHaveBeenNthCalledWith(1, 1, 2);
    expect(update).toHaveBeenNthCalledWith(2, 2, 1);
    expect(mocks.db.exec).toHaveBeenLastCalledWith("COMMIT");
  });
});
