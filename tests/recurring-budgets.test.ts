import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import { materializeRecurringBudgets } from "@/lib/budgets";

describe("materializeRecurringBudgets", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(`CREATE TABLE budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      month TEXT NOT NULL,
      amount REAL NOT NULL,
      rollover INTEGER NOT NULL DEFAULT 0,
      recurring INTEGER NOT NULL DEFAULT 0,
      recurrence_start TEXT,
      recurrence_generated INTEGER NOT NULL DEFAULT 0,
      recurrence_deleted INTEGER NOT NULL DEFAULT 0
    )`);
  });

  it("materializes opted-in budgets forward from their start month idempotently", () => {
    db.prepare(`INSERT INTO budgets(category_id, month, amount, rollover, recurring, recurrence_start)
      VALUES(?, ?, ?, ?, ?, ?)`).run(2, "2026-05", 400, 1, 1, "2026-05");

    materializeRecurringBudgets(db, "2026-07");
    materializeRecurringBudgets(db, "2026-07");

    expect(db.prepare("SELECT category_id, month, amount, rollover, recurring, recurrence_start FROM budgets ORDER BY month").all()).toEqual([
      { category_id: 2, month: "2026-05", amount: 400, rollover: 1, recurring: 1, recurrence_start: "2026-05" },
      { category_id: 2, month: "2026-06", amount: 400, rollover: 1, recurring: 1, recurrence_start: "2026-05" },
      { category_id: 2, month: "2026-07", amount: 400, rollover: 1, recurring: 1, recurrence_start: "2026-05" },
    ]);
  });

  it("repeats across a year boundary without JavaScript's 1900 year offset", () => {
    db.prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
      VALUES(?, ?, ?, ?, ?)`).run(null, "0099-12", 400, 1, "0099-12");

    materializeRecurringBudgets(db, "0100-01");

    expect(db.prepare("SELECT month FROM budgets ORDER BY month").all()).toEqual([
      { month: "0099-12" }, { month: "0100-01" },
    ]);
  });

  it("does not materialize backwards or replace a manual budget", () => {
    db.prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
      VALUES(?, ?, ?, ?, ?)`).run(2, "2026-05", 400, 1, "2026-05");
    db.prepare("INSERT INTO budgets(category_id, month, amount) VALUES(?, ?, ?)").run(2, "2026-07", 250);

    materializeRecurringBudgets(db, "2026-04");
    materializeRecurringBudgets(db, "2026-07");

    expect(db.prepare("SELECT month, amount FROM budgets ORDER BY month").all()).toEqual([
      { month: "2026-05", amount: 400 },
      { month: "2026-06", amount: 400 },
      { month: "2026-07", amount: 250 },
    ]);
  });

  it("uses the latest amount and stops after an edited repeated instance", () => {
    const insert = db.prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
      VALUES(?, ?, ?, ?, ?)`);
    insert.run(2, "2026-05", 400, 1, "2026-05");
    insert.run(2, "2026-06", 500, 1, "2026-05");

    materializeRecurringBudgets(db, "2026-07");
    db.prepare("UPDATE budgets SET recurring=0, recurrence_generated=0 WHERE month='2026-07'").run();
    materializeRecurringBudgets(db, "2026-08");

    expect(db.prepare("SELECT month, amount, recurring FROM budgets ORDER BY month").all()).toEqual([
      { month: "2026-05", amount: 400, recurring: 1 },
      { month: "2026-06", amount: 500, recurring: 1 },
      { month: "2026-07", amount: 500, recurring: 0 },
    ]);
  });

  it("reconciles generated future rows after an earlier instance is edited", () => {
    db.prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
      VALUES(?, ?, ?, ?, ?)`).run(2, "2026-05", 400, 1, "2026-05");
    materializeRecurringBudgets(db, "2026-07");
    db.prepare(`UPDATE budgets SET amount=500, recurrence_generated=0
      WHERE category_id=2 AND month='2026-06'`).run();

    materializeRecurringBudgets(db, "2026-07");
    materializeRecurringBudgets(db, "2026-08");

    expect(db.prepare("SELECT month, amount FROM budgets ORDER BY month").all()).toEqual([
      { month: "2026-05", amount: 400 },
      { month: "2026-06", amount: 500 },
      { month: "2026-07", amount: 500 },
      { month: "2026-08", amount: 500 },
    ]);
  });

  it("removes generated future rows after an earlier instance stops without replacing manual overrides", () => {
    db.prepare(`INSERT INTO budgets(category_id, month, amount, recurring, recurrence_start)
      VALUES(?, ?, ?, ?, ?)`).run(2, "2026-05", 400, 1, "2026-05");
    materializeRecurringBudgets(db, "2026-07");
    db.prepare(`UPDATE budgets SET recurring=0, recurrence_generated=0
      WHERE category_id=2 AND month='2026-06'`).run();
    db.prepare("UPDATE budgets SET amount=275, recurring=0, recurrence_start=NULL, recurrence_generated=0 WHERE month='2026-07'").run();

    materializeRecurringBudgets(db, "2026-07");
    materializeRecurringBudgets(db, "2026-08");

    expect(db.prepare("SELECT month, amount, recurring FROM budgets ORDER BY month").all()).toEqual([
      { month: "2026-05", amount: 400, recurring: 1 },
      { month: "2026-06", amount: 400, recurring: 0 },
      { month: "2026-07", amount: 275, recurring: 0 },
    ]);
  });
});
