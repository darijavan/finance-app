import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { exec: vi.fn(), prepare: vi.fn() },
  getConverter: vi.fn(),
  refreshRates: vi.fn(),
  undoActivity: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getDb: () => mocks.db,
  logActivity: mocks.logActivity,
  undoActivity: mocks.undoActivity,
}));
vi.mock("@/lib/fx", () => ({ getConverter: mocks.getConverter, refreshRates: mocks.refreshRates }));

const settings = await import("../app/api/settings/route");
const fx = await import("../app/api/fx/route");
const months = await import("../app/api/months/route");
const trends = await import("../app/api/trends/route");
const activity = await import("../app/api/activity/route");
const undo = await import("../app/api/activity/[id]/undo/route");
const statementImports = await import("../app/api/statement-imports/route");

const request = (path: string, body?: unknown) => new NextRequest(`http://localhost${path}`, {
  method: body === undefined ? "GET" : "POST",
  body: body === undefined ? undefined : JSON.stringify(body),
  headers: { "content-type": "application/json" },
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("settings and FX routes", () => {
  it("shapes settings rows into a key-value response", async () => {
    mocks.db.prepare.mockReturnValue({ all: () => [{ key: "currency", value: "USD" }, { key: "currency_symbol", value: "$" }] });

    const response = await settings.GET();

    expect(await response.json()).toEqual({ currency: "USD", currency_symbol: "$" });
  });

  it("rejects settings writes without an allowed key", async () => {
    const response = await settings.PUT(request("/api/settings", { theme: "dark" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "no valid settings keys" });
    expect(mocks.db.exec).not.toHaveBeenCalled();
  });

  it("returns the configured converter and honors force refresh", async () => {
    mocks.getConverter.mockResolvedValue({ base: "ILS", rates: { ILS: 1, USD: 0.27 } });
    mocks.refreshRates.mockResolvedValue({ ILS: 1, USD: 0.27 });

    const getResponse = await fx.GET();
    const postResponse = await fx.POST(request("/api/fx?force=1", {}));

    expect(await getResponse.json()).toEqual({ base: "ILS", rates: { ILS: 1, USD: 0.27 } });
    expect(await postResponse.json()).toEqual({ ok: true, rates: { ILS: 1, USD: 0.27 } });
    expect(mocks.refreshRates).toHaveBeenCalledWith(true);
  });
});

describe("months and trends routes", () => {
  it("falls back to the current month when no transaction months exist", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));
    mocks.db.prepare.mockReturnValue({ all: () => [] });

    const response = await months.GET();

    expect(await response.json()).toEqual(["2026-08"]);
  });

  it("returns base-currency flow and account-native net worth for the requested window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00Z"));
    mocks.getConverter.mockResolvedValue({
      base: "ILS",
      toBase: (amount: number, currency: string) => currency === "USD" ? amount * 4 : amount,
    });
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("amount, currency, direction"))

      return { all: () => [{ m: "2026-08", amount: 10, currency: "USD", direction: "expense" }, { m: "2026-08", amount: 5, currency: "ILS", direction: "income" }] };
      if (sql === "SELECT id, currency FROM accounts")

      return { all: () => [{ id: 1, currency: "USD" }] };
      if (sql.includes("FROM transactions WHERE account_id"))

      return { all: () => [{ account_id: 1, m: "2026-08", amount: 10, account_amount: 8, direction: "income" }] };

      return { all: () => [] };
    });

    const response = await trends.GET(request("/api/trends?months=1"));

    expect(await response.json()).toEqual({ base: "ILS", months: [{ month: "2026-08", spent: 40, earned: 5, net_worth: 32 }] });
  });
});

describe("activity routes", () => {
  it("maps reversible delete records and caps the requested list size", async () => {
    const all = vi.fn(() => [
      { id: 8, entity: "transaction", action: "delete", entity_id: 4, summary: "Deleted lunch", created_at: "2026-08-16", has_payload: 1 },
      { id: 7, entity: "transaction", action: "create", entity_id: 5, summary: "Added coffee", created_at: "2026-08-15", has_payload: 1 },
    ]);
    mocks.db.prepare.mockReturnValue({ all });

    const response = await activity.GET(request("/api/activity?limit=999"));

    expect(await response.json()).toEqual([
      { id: 8, entity: "transaction", action: "delete", entity_id: 4, summary: "Deleted lunch", created_at: "2026-08-16", undoable: true },
      { id: 7, entity: "transaction", action: "create", entity_id: 5, summary: "Added coffee", created_at: "2026-08-15", undoable: false },
    ]);
    expect(all).toHaveBeenCalledWith(500);
  });

  it("returns a conflict when an activity record cannot be undone", async () => {
    mocks.undoActivity.mockReturnValue(null);

    const response = await undo.POST(request("/api/activity/8/undo", {}), { params: Promise.resolve({ id: "8" }) });

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "This action can't be undone (not a reversible delete or already undone)." });
  });

  it("reports the restored record id after a successful undo", async () => {
    mocks.undoActivity.mockReturnValue(42);

    const response = await undo.POST(request("/api/activity/8/undo", {}), { params: Promise.resolve({ id: "8" }) });

    expect(await response.json()).toEqual({ ok: true, restored_id: 42 });
    expect(mocks.undoActivity).toHaveBeenCalledWith(mocks.db, 8);
  });
});

describe("statement import routes", () => {
  it("returns import summaries with account and classification counts", async () => {
    mocks.db.prepare.mockReturnValue({ all: () => [{ id: 3, source: "bank", account_name: "Checking", row_count: 4, new_count: 2, duplicate_count: 1, review_count: 1 }] });

    const response = await statementImports.GET();

    expect(await response.json()).toEqual([{ id: 3, source: "bank", account_name: "Checking", row_count: 4, new_count: 2, duplicate_count: 1, review_count: 1 }]);
  });

  it("rejects malformed import requests before reading the database", async () => {
    const response = await statementImports.POST(request("/api/statement-imports", { account_id: 1, currency: "ILS", source: "bank", source_fingerprint: "not-a-hash", rows: [] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid statement import" });
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("returns account-not-found for an otherwise valid statement import", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => undefined });
    const fingerprint = "a".repeat(64);

    const response = await statementImports.POST(request("/api/statement-imports", {
      account_id: 1,
      currency: "ILS",
      source: "bank",
      source_fingerprint: fingerprint,
      rows: [{ date: "2026-08-15", amount: 12.5, direction: "expense", note: "Coffee" }],
    }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "account not found" });
  });
});
