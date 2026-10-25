import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// DELETE /api/budgets/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const row = db.prepare("SELECT * FROM budgets WHERE id=?").get(id) as any;
  if (!row) 

  return NextResponse.json({ ok: true, log_id: null });
  if (row.recurrence_start) {
    db.prepare("DELETE FROM budgets WHERE category_id IS ? AND month>? AND recurrence_start=? AND recurrence_generated=1")
      .run(row.category_id, row.month, row.recurrence_start);
    db.prepare("UPDATE budgets SET recurring=0, recurrence_generated=0, recurrence_deleted=1 WHERE id=?").run(id);
  } else {
    db.prepare("DELETE FROM budgets WHERE id=?").run(id);
  }
  const logId = logActivity(db, "budget", "delete", id,
    `Deleted budget #${id} (${row.amount} for ${row.month}${row.category_id == null ? ", overall" : `, category #${row.category_id}`})`,
    { table: "budgets", ...row });
  
  return NextResponse.json({ ok: true, log_id: logId });
}
