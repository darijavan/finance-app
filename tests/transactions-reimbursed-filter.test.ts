import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ db: null as DatabaseSync | null }));

vi.mock("@/lib/db", () => ({ getDb: () => mocks.db }));

const { GET } = await import("../app/api/transactions/route");

beforeEach(() => {
  mocks.db?.close();
  mocks.db = new DatabaseSync(":memory:");
  mocks.db.exec(`
    CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, color TEXT);
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT);
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY, date TEXT, reimbursable INTEGER, reimbursed_at TEXT,
      category_id INTEGER, account_id INTEGER, subscription_id INTEGER, note TEXT
    );
    INSERT INTO transactions VALUES
      (1, '2026-08-01', 1, '2026-08-10T00:00:00.000Z', NULL, NULL, NULL, 'paid'),
      (2, '2026-08-02', 1, NULL, NULL, NULL, NULL, 'pending'),
      (3, '2026-08-03', 0, NULL, NULL, NULL, NULL, 'ordinary');
  `);
});

async function ids(query: string) {
  const response = await GET(new NextRequest(`http://localhost/api/transactions?${query}`));
  const rows = await response.json() as { id: number }[];

  return { response, ids: rows.map((row) => row.id) };
}

describe("GET /api/transactions reimbursed filter", () => {
  it("returns reimbursed or pending reimbursable rows", async () => {
    await expect(ids("reimbursed=1")).resolves.toMatchObject({ ids: [1] });
    await expect(ids("reimbursed=0")).resolves.toMatchObject({ ids: [2] });
  });

  it("retains reimbursable behavior and combines both filters", async () => {
    await expect(ids("reimbursable=0")).resolves.toMatchObject({ ids: [3] });
    await expect(ids("reimbursable=0&reimbursed=1")).resolves.toMatchObject({ ids: [] });
  });

  it("rejects a malformed reimbursed parameter", async () => {
    const response = await GET(new NextRequest("http://localhost/api/transactions?reimbursed=yes"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "reimbursed must be 1 or 0" });
  });
});
