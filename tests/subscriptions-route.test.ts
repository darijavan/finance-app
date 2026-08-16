import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));

const collection = await import("../app/api/subscriptions/route");
const detail = await import("../app/api/subscriptions/[id]/route");

function request(url: string, method: string, body?: unknown) {

  return new NextRequest(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("subscriptions routes", () => {
  it("adds charge metadata to collection rows", async () => {
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.includes("FROM subscriptions s")) {

        return { all: () => [{ id: 1, name: "Music", amount: 12, frequency: "monthly" }, { id: 2, name: "Yearly", amount: 120, frequency: "yearly" }] };
      }

      return { all: () => [{ subscription_id: 1, amount: 10 }] };
    });

    const response = await collection.GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { id: 1, name: "Music", amount: 12, frequency: "monthly", monthly_equivalent: 12, last_charge_amount: 10 },
      { id: 2, name: "Yearly", amount: 120, frequency: "yearly", monthly_equivalent: null, last_charge_amount: null },
    ]);
  });

  it("rejects invalid subscription collection input", async () => {
    const response = await collection.POST(request("http://localhost/api/subscriptions", "POST", {
      name: "Rent", amount: 10, currency: "XYZ", start_date: "not-a-date",
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid currency, start date, category, or account" });
  });

  it("updates supplied subscription fields while preserving charge history", async () => {
    const update = vi.fn();
    mocks.db.prepare.mockImplementation((sql: string) => {
      if (sql.startsWith("SELECT * FROM subscriptions")) {

        return { get: () => ({ id: 5, name: "Hosting", amount: 10, currency: "USD", direction: "expense", day_of_month: 5, frequency: "monthly" }) };
      }
      if (sql.startsWith("UPDATE subscriptions")) {

        return { run: update };
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const response = await detail.PUT(request("http://localhost/api/subscriptions/5", "PUT", { active: false, amount: 15 }), { params: Promise.resolve({ id: "5" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(15, 0, 5);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "subscription", "update", 5, "Updated subscription #5 (amount=?, active=?) — was \"Hosting\"");
  });

  it("rejects invalid detail fields and deletion", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 5, name: "Hosting", amount: 10, currency: "USD", direction: "expense", day_of_month: 5, frequency: "monthly" }) });

    const invalid = await detail.PUT(request("http://localhost/api/subscriptions/5", "PUT", { active: "false" }), { params: Promise.resolve({ id: "5" }) });
    const deleted = await detail.DELETE(request("http://localhost/api/subscriptions/5", "DELETE"), { params: Promise.resolve({ id: "5" }) });

    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "active must be a boolean" });
    expect(deleted.status).toBe(405);
    expect(await deleted.json()).toEqual({ error: "Subscriptions are retained for charge history. Set active=false instead." });
  });
});
