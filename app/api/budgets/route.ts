import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { moneyOrZero, isoMonth, optionalId } from "@/lib/validate";
import { materializeRecurringBudgets } from "@/lib/budgets";

export const dynamic = "force-dynamic";

// GET /api/budgets?month=YYYY-MM
// PUT /api/budgets        body: { month, category_id?, amount }
// DELETE /api/budgets/[id]
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const requestedMonth = searchParams.get("month");
  const month = requestedMonth == null ? new Date().toISOString().slice(0, 7) : isoMonth(requestedMonth);
  if (!month) return NextResponse.json({ error: "valid month required" }, { status: 400 });
  materializeRecurringBudgets(db, month);
  const rows = db.prepare(
    `SELECT b.*, c.name AS category_name, c.color AS category_color
     FROM budgets b LEFT JOIN categories c ON b.category_id=c.id
     WHERE b.month=? AND b.recurrence_deleted=0`
  ).all(month);
  
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const month = b.month == null ? new Date().toISOString().slice(0, 7) : isoMonth(b.month);
  const category_id = optionalId(b.category_id);
  const amount = moneyOrZero(b.amount);
  if (!month || amount == null || category_id === undefined || (b.recurring != null && typeof b.recurring !== "boolean")) {
    
    return NextResponse.json({ error: "valid amount and category required" }, { status: 400 });
  }
  const rollover = b.rollover ? 1 : 0;
  const recurring = b.recurring ? 1 : 0;
  materializeRecurringBudgets(db, month);
  const existing = db.prepare(
    "SELECT recurring, recurrence_start FROM budgets WHERE month=? AND category_id IS ?",
  ).get(month, category_id) as { recurring: number; recurrence_start: string | null } | undefined;
  const recurrenceStart = recurring ? (existing?.recurrence_start || month) : (existing?.recurrence_start || null);
  if (existing?.recurrence_start) {
    db.prepare(`DELETE FROM budgets WHERE category_id IS ? AND month>? AND recurrence_start=?
      AND recurrence_generated=1`).run(category_id, month, existing.recurrence_start);
  }
  // Idempotent: remove any existing row for this (category, month) first, then insert.
  // This avoids duplicate NULL-category ("Overall") rows, since NULL != NULL in SQLite's
  // unique constraint.
  db.prepare("DELETE FROM budgets WHERE month=? AND (category_id IS ? OR (category_id IS NULL AND ? IS NULL))")
    .run(month, category_id, category_id);
  db.prepare(`INSERT INTO budgets(category_id,month,amount,rollover,recurring,recurrence_start,
    recurrence_generated,recurrence_deleted) VALUES(?,?,?,?,?,?,0,0)`)
    .run(category_id, month, amount, rollover, recurring, recurrenceStart);
  const newId = Number((db.prepare("SELECT last_insert_rowid() AS id").get() as any).id);
  const scope = category_id == null ? "overall" : `category #${category_id}`;
  logActivity(db, "budget", "create", newId, `Set ${scope} budget for ${month} = ${amount}`);
  
  return NextResponse.json({ ok: true });
}
