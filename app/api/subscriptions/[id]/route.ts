import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { money, currency, oneOf, isoDate, optionalId, intInRange } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PUT /api/subscriptions/[id]
// DELETE /api/subscriptions/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const before = db.prepare("SELECT * FROM subscriptions WHERE id=?").get(id) as any;
  if (!before) return NextResponse.json({ error: "subscription not found" }, { status: 404 });
  const b = await req.json();
  // Same validation rules as POST, applied only to the supplied fields.
  const validated: Record<string, unknown> = {
    name: "name" in b ? String(b.name ?? "").trim() || null : undefined,
    amount: "amount" in b ? money(b.amount) : undefined,
    currency: "currency" in b ? currency(b.currency, before.currency) : undefined,
    direction: "direction" in b ? oneOf(b.direction, ["expense", "income"] as const, before.direction) : undefined,
    category_id: "category_id" in b ? optionalId(b.category_id) : undefined,
    frequency: "frequency" in b ? oneOf(b.frequency, ["monthly", "yearly"] as const, before.frequency) : undefined,
    day_of_month: "day_of_month" in b ? intInRange(b.day_of_month, 1, 28, before.day_of_month) : undefined,
    month_of_year: "month_of_year" in b ? (b.month_of_year == null ? null : intInRange(b.month_of_year, 1, 12, 1)) : undefined,
    note: "note" in b ? String(b.note ?? "") : undefined,
    start_date: "start_date" in b ? (b.start_date ? isoDate(b.start_date) : null) : undefined,
    account_id: "account_id" in b ? optionalId(b.account_id) : undefined,
  };
  if (validated.name === null || validated.amount === null ||
      ("currency" in b && validated.currency == null) ||
      ("start_date" in b && b.start_date && validated.start_date == null) ||
      validated.category_id === undefined && "category_id" in b ||
      validated.account_id === undefined && "account_id" in b) {
    return NextResponse.json({ error: "invalid field value" }, { status: 400 });
  }
  const fields: string[] = [];
  const args: any[] = [];
  for (const [k, v] of Object.entries(validated)) {
    if (v !== undefined) { args.push(v); fields.push(`${k}=?`); }
  }
  if ("active" in b) { args.push(b.active ? 1 : 0); fields.push("active=?"); }
  if (!fields.length) return NextResponse.json({ ok: true });
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
