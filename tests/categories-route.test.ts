import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  db: { prepare: vi.fn() },
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db, logActivity: mocks.logActivity }));

const categories = await import("../app/api/categories/route");
const category = await import("../app/api/categories/[id]/route");

function request(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/categories", {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/api/categories", () => {
  it("returns categories in the route query result", async () => {
    const rows = [{ id: 2, name: "Food", direction: "expense", color: "#123456" }];
    mocks.db.prepare.mockReturnValue({ all: () => rows });

    const response = await categories.GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(rows);
  });

  it("rejects a blank category name at the request boundary", async () => {
    const response = await categories.POST(request("POST", { name: "  " }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "name required" });
    expect(mocks.db.prepare).not.toHaveBeenCalled();
  });

  it("persists a trimmed category and returns the created row", async () => {
    const insert = vi.fn(() => ({ lastInsertRowid: 6 }));
    const row = { id: 6, name: "Salary", direction: "income", color: "#45d" };
    mocks.db.prepare.mockImplementation((sql: string) => sql.startsWith("INSERT")
      ? { run: insert }
      : { get: () => row });

    const response = await categories.POST(request("POST", { name: " Salary ", color: "#45d", direction: "income" }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(row);
    expect(insert).toHaveBeenCalledWith("Salary", "#45d", "income");
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "category", "create", 6, "Added category \"Salary\" (income)");
  });
});

describe("PUT /api/categories/[id]", () => {
  it("rejects an empty replacement name", async () => {
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 6, name: "Food", color: "#111", direction: "expense" }) });

    const response = await category.PUT(request("PUT", { name: "" }), { params: Promise.resolve({ id: "6" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "name required" });
  });

  it("updates the category with enum-safe direction and returns the saved row", async () => {
    const update = vi.fn();
    const before = { id: 6, name: "Food", color: "#111", direction: "expense" };
    const saved = { id: 6, name: "Groceries", color: "#222", direction: "income" };
    let selects = 0;
    mocks.db.prepare.mockImplementation((sql: string) => sql.startsWith("UPDATE")
      ? { run: update }
      : { get: () => ++selects === 1 ? before : saved });

    const response = await category.PUT(request("PUT", { name: "Groceries", color: "#222", direction: "income" }), { params: Promise.resolve({ id: "6" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(saved);
    expect(update).toHaveBeenCalledWith("Groceries", "#222", "income", 6);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "category", "update", 6, "Updated category #6 to \"Groceries\" (income) — was \"Food\"");
  });
});

describe("DELETE /api/categories/[id]", () => {
  it("deletes an existing category and returns the undo log id", async () => {
    const remove = vi.fn();
    mocks.logActivity.mockReturnValue(13);
    mocks.db.prepare.mockReturnValue({ get: () => ({ id: 6, name: "Food", direction: "expense" }), run: remove });

    const response = await category.DELETE(request("DELETE"), { params: Promise.resolve({ id: "6" }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, log_id: 13 });
    expect(remove).toHaveBeenCalledWith(6);
    expect(mocks.logActivity).toHaveBeenCalledWith(mocks.db, "category", "delete", 6, "Deleted category #6 (\"Food\", expense)", { table: "categories", id: 6, name: "Food", direction: "expense" });
  });
});
