import type { DatabaseSync } from "node:sqlite";

type BudgetRow = {
  category_id: number | null;
  month: string;
  amount: number;
  rollover: number;
  recurring: number;
  recurrence_start: string | null;
  recurrence_generated: number;
  recurrence_deleted: number;
};

const scopeKey = (categoryId: number | null) => categoryId == null ? "overall" : String(categoryId);

const nextMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);

  return `${String(year + (monthNumber === 12 ? 1 : 0)).padStart(4, "0")}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, "0")}`;
};

export function materializeRecurringBudgets(db: DatabaseSync, throughMonth: string) {
  const rows = db.prepare(
    `SELECT category_id, month, amount, rollover, recurring, recurrence_start,
            recurrence_generated, recurrence_deleted
     FROM budgets WHERE month<=? ORDER BY month, id`,
  ).all(throughMonth) as BudgetRow[];
  const starts = rows.flatMap((row) => row.recurrence_start ? [row.recurrence_start] : []);
  if (starts.length === 0) return;

  const byMonth = new Map<string, BudgetRow[]>();
  for (const row of rows) byMonth.set(row.month, [...(byMonth.get(row.month) || []), row]);

  const latest = new Map<string, BudgetRow>();
  const insert = db.prepare(
    `INSERT INTO budgets(category_id, month, amount, rollover, recurring, recurrence_start, recurrence_generated)
     VALUES(?, ?, ?, ?, 1, ?, 1)`,
  );
  const update = db.prepare("UPDATE budgets SET amount=?, rollover=?, recurring=1, recurrence_start=? WHERE category_id IS ? AND month=?");
  const remove = db.prepare("DELETE FROM budgets WHERE category_id IS ? AND month=? AND recurrence_generated=1");
  for (let month = starts.sort()[0]; month <= throughMonth; month = nextMonth(month)) {
    const current = byMonth.get(month) || [];
    const occupied = new Set(current.map((row) => scopeKey(row.category_id)));
    for (const row of current) {
      if (row.recurrence_start && !row.recurrence_generated) latest.set(scopeKey(row.category_id), row);
    }
    for (const row of current) {
      if (!row.recurrence_generated) continue;
      const source = latest.get(scopeKey(row.category_id));
      if (!source?.recurring || source.recurrence_deleted || source.recurrence_start! > month) {
        remove.run(row.category_id, month);
        occupied.delete(scopeKey(row.category_id));
      } else {
        update.run(source.amount, source.rollover, source.recurrence_start, row.category_id, month);
      }
    }
    for (const [key, source] of latest) {
      if (occupied.has(key) || !source.recurring || source.recurrence_deleted || source.recurrence_start! > month) continue;
      insert.run(source.category_id, month, source.amount, source.rollover, source.recurrence_start);
    }
    if (month === throughMonth) break;
  }
}
