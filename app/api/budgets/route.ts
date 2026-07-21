import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { moneyOrZero, isoMonth, optionalId } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/budgets?month=YYYY-MM
// PUT /api/budgets        body: { month, category_id?, amount }
// DELETE /api/budgets/[id]
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const rows = db.prepare(
    `SELECT b.*, c.name AS category_name, c.color AS category_color
     FROM budgets b LEFT JOIN categories c ON b.category_id=c.id WHERE b.month=?`
  ).all(month);
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const month = isoMonth(b.month) ?? new Date().toISOString().slice(0, 7);
  const category_id = optionalId(b.category_id);
  const amount = moneyOrZero(b.amount);
  if (amount == null || category_id === undefined) {
    return NextResponse.json({ error: "valid amount and category required" }, { status: 400 });
  }
  const rollover = b.rollover ? 1 : 0;
  // Idempotent: remove any existing row for this (category, month) first, then insert.
  // This avoids duplicate NULL-category ("Overall") rows, since NULL != NULL in SQLite's
  // unique constraint.
  db.prepare("DELETE FROM budgets WHERE month=? AND (category_id IS ? OR (category_id IS NULL AND ? IS NULL))")
    .run(month, category_id, category_id);
  db.prepare("INSERT INTO budgets(category_id,month,amount,rollover) VALUES(?,?,?,?)").run(category_id, month, amount, rollover);
  const newId = Number((db.prepare("SELECT last_insert_rowid() AS id").get() as any).id);
  const scope = category_id == null ? "overall" : `category #${category_id}`;
  logActivity(db, "budget", "create", newId, `Set ${scope} budget for ${month} = ${amount}`);
  return NextResponse.json({ ok: true });
}
