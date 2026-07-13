import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/subscriptions/charge?month=YYYY-MM
// Creates transactions for every active subscription due in that month.
// Monthly subs -> always charged. Yearly subs -> charged only in their month_of_year.
export async function POST(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const subs = db.prepare("SELECT * FROM subscriptions WHERE active=1").all() as any[];
  const insert = db.prepare(
    "INSERT INTO transactions(amount,currency,direction,category_id,date,note,created_at) VALUES(?,?,?,?,?,?,?)"
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
        insert.run(s.amount, s.currency || "ILS", s.direction, s.category_id, date, `[auto] ${s.name} (${s.frequency})`, new Date().toISOString());
        created++;
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  return NextResponse.json({ created });
}
