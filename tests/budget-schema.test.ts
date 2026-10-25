import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
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

it("adds recurring budget fields to a legacy database with non-recurring defaults", async () => {
  directory = mkdtempSync(join(tmpdir(), "finance-budget-schema-"));
  mkdirSync(join(directory, "data"));
  const legacy = new DatabaseSync(join(directory, "data", "finance.db"));
  legacy.exec(`CREATE TABLE budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    month TEXT NOT NULL,
    amount REAL NOT NULL,
    rollover INTEGER NOT NULL DEFAULT 0
  )`);
  legacy.prepare("INSERT INTO budgets(category_id, month, amount) VALUES(?, ?, ?)").run(2, "2026-05", 400);
  legacy.close();
  process.chdir(directory);

  const { getDb } = await import("@/lib/db");
  const row = getDb().prepare("SELECT recurring, recurrence_start, recurrence_generated, recurrence_deleted FROM budgets").get();

  expect(row).toEqual({ recurring: 0, recurrence_start: null, recurrence_generated: 0, recurrence_deleted: 0 });
});
