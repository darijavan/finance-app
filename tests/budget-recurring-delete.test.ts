import { NextRequest } from "next/server";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const originalCwd = process.cwd();
let directory: string | undefined;

afterEach(() => {
  process.chdir(originalCwd);
  if (directory) rmSync(directory, { recursive: true, force: true });
  directory = undefined;
  vi.resetModules();
});

const getMonth = (route: typeof import("../app/api/budgets/route"), month: string) =>
  route.GET(new NextRequest(`http://localhost/api/budgets?month=${month}`));

const putBudget = (route: typeof import("../app/api/budgets/route"), body: unknown) =>
  route.PUT(new NextRequest("http://localhost/api/budgets", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }));

it("reconciles future months after an earlier recurring budget is edited and stopped", async () => {
  directory = mkdtempSync(join(tmpdir(), "finance-budget-edit-"));
  process.chdir(directory);
  const budgets = await import("../app/api/budgets/route");
  const { getDb } = await import("@/lib/db");
  getDb().prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
    VALUES(NULL, '2026-05', 400, 1, '2026-05')`).run();

  await getMonth(budgets, "2026-07");
  await putBudget(budgets, { month: "2026-06", category_id: null, amount: 500, recurring: true });
  expect((await (await getMonth(budgets, "2026-07")).json())[0]).toMatchObject({ amount: 500, recurring: 1 });
  expect((await (await getMonth(budgets, "2026-08")).json())[0]).toMatchObject({ amount: 500, recurring: 1 });

  await putBudget(budgets, { month: "2026-06", category_id: null, amount: 500, recurring: false });
  await expect((await getMonth(budgets, "2026-07")).json()).resolves.toEqual([]);
  await expect((await getMonth(budgets, "2026-08")).json()).resolves.toEqual([]);
  expect((await (await getMonth(budgets, "2026-05")).json())[0]).toMatchObject({ amount: 400, recurring: 1 });
});

it("keeps a deleted recurring month gone until its snapshot is undone", async () => {
  directory = mkdtempSync(join(tmpdir(), "finance-budget-delete-"));
  process.chdir(directory);
  const budgets = await import("../app/api/budgets/route");
  const budget = await import("../app/api/budgets/[id]/route");
  const undo = await import("../app/api/activity/[id]/undo/route");
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  db.prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
    VALUES(NULL, '2026-05', 400, 1, '2026-05')`).run();

  await getMonth(budgets, "2026-07");
  const june = db.prepare("SELECT id FROM budgets WHERE month='2026-06'").get() as { id: number };
  const deleted = await budget.DELETE(new NextRequest("http://localhost/api/budgets", { method: "DELETE" }), {
    params: Promise.resolve({ id: String(june.id) }),
  });
  const { log_id: logId } = await deleted.json();

  await expect((await getMonth(budgets, "2026-06")).json()).resolves.toEqual([]);
  await expect((await getMonth(budgets, "2026-07")).json()).resolves.toEqual([]);
  expect(db.prepare("SELECT month FROM budgets WHERE month<'2026-06' AND recurrence_deleted=0").all()).toEqual([{ month: "2026-05" }]);

  const restored = await undo.POST(new NextRequest("http://localhost/api/activity/undo", { method: "POST" }), {
    params: Promise.resolve({ id: String(logId) }),
  });
  expect(restored.status).toBe(200);
  expect((await (await getMonth(budgets, "2026-06")).json())[0]).toMatchObject({ amount: 400, recurring: 1 });
  expect((await (await getMonth(budgets, "2026-07")).json())[0]).toMatchObject({ amount: 400, recurring: 1 });
});
