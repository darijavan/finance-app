import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// PUT /api/subscriptions/[id]
// DELETE /api/subscriptions/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const before = db.prepare("SELECT * FROM subscriptions WHERE id=?").get(id) as any;
  const b = await req.json();
  const fields: string[] = [];
  const args: any[] = [];
  for (const k of ["name", "amount", "currency", "direction", "category_id", "frequency", "day_of_month", "month_of_year", "note", "start_date", "account_id"]) {
    if (k in b) { args.push(b[k]); fields.push(`${k}=?`); }
  }
  if ("active" in b) { args.push(b.active ? 1 : 0); fields.push("active=?"); }
  args.push(id);
  db.prepare(`UPDATE subscriptions SET ${fields.join(", ")} WHERE id=?`).run(...args);
  logActivity(db, "subscription", "update", id,
    `Updated subscription #${id} (${fields.join(", ") || "no fields"})${before ? ` — was "${before.name}"` : ""}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const row = db.prepare("SELECT * FROM subscriptions WHERE id=?").get(id) as any;
  if (!row) return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM subscriptions WHERE id=?").run(id);
  const logId = logActivity(db, "subscription", "delete", id,
    `Deleted subscription #${id} ("${row.name}", ${row.amount} ${row.currency || ""}, ${row.frequency})`,
    { table: "subscriptions", ...row });
  return NextResponse.json({ ok: true, log_id: logId });
}
