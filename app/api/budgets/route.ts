import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
  const month = b.month || new Date().toISOString().slice(0, 7);
  const category_id = b.category_id != null ? Number(b.category_id) : null;
  const amount = Math.abs(Number(b.amount));
  // Idempotent: remove any existing row for this (category, month) first, then insert.
  // This avoids duplicate NULL-category ("Overall") rows, since NULL != NULL in SQLite's
  // unique constraint.
  db.prepare("DELETE FROM budgets WHERE month=? AND (category_id IS ? OR (category_id IS NULL AND ? IS NULL))")
    .run(month, category_id, category_id);
  db.prepare("INSERT INTO budgets(category_id,month,amount) VALUES(?,?,?)").run(category_id, month, amount);
  return NextResponse.json({ ok: true });
}
