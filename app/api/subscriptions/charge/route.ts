import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/subscriptions/charge?month=YYYY-MM
// Creates any uncharged subscriptions due on or before today. Future months are never charged.
export async function POST(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const now = new Date();
  // Use the server's local calendar date (the finance service runs in Israel time), not UTC.
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const month = searchParams.get("month") || today.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  const [y, m] = month.split("-").map(Number);
  const currentMonth = today.slice(0, 7);
  // The button may backfill a past month, but must never book charges dated in the future.
  const cutoffDay = month < currentMonth ? 28 : month === currentMonth ? Number(today.slice(8, 10)) : 0;
  const subs = db.prepare("SELECT * FROM subscriptions WHERE active=1").all() as any[];
  const insert = db.prepare(
    "INSERT OR IGNORE INTO transactions(amount,currency,direction,category_id,date,note,account_id,subscription_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)"
  );
  db.exec("BEGIN");
  let created = 0;
  try {
    for (const s of subs as any[]) {
      let due = false;
      if (s.frequency === "monthly") due = true;
      else if (s.frequency === "yearly") due = s.month_of_year === m;
      if (due) {
        const day = Math.min(s.day_of_month || 1, 28);
        const date = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        // Do not charge ahead of its due day or before the subscription itself began.
        if (day > cutoffDay || (s.start_date && date < s.start_date)) continue;
        const result = insert.run(
          s.amount, s.currency || "ILS", s.direction, s.category_id, date,
          `[auto] ${s.name} (${s.frequency})`, s.account_id ?? null, s.id, now.toISOString(),
        );
        if (result.changes > 0) created++;
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  if (created > 0) {
    logActivity(db, "transaction", "create", null,
      `Charged ${created} subscription(s) for ${month}`);
  }
  return NextResponse.json({ created });
}
