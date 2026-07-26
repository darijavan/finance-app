import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { snapshotConversion } from "@/lib/fx-historical";
import { chargeDate } from "@/lib/subscription-due";

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
  const subs = db.prepare("SELECT * FROM subscriptions WHERE active=1").all() as any[];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO transactions(amount,currency,direction,category_id,date,note,account_id,subscription_id,
      account_amount,account_currency,account_fx_rate,account_fx_date,account_fx_source,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  db.exec("BEGIN");
  let created = 0;
  const chargedNames: string[] = [];
  try {
    for (const s of subs as any[]) {
      // The button may backfill a past month, but must never book charges dated
      // in the future, ahead of the due day, or before the subscription began.
      const date = chargeDate(s, month, today);
      if (date != null) {
        let snap: any = { account_amount: null, account_currency: null, account_fx_rate: null, account_fx_date: null, account_fx_source: null };
        if (s.account_id != null) {
          const account = db.prepare("SELECT currency FROM accounts WHERE id=?").get(s.account_id) as any;
          if (!account) throw new Error(`subscription account ${s.account_id} not found`);
          const fx = await snapshotConversion(s.amount, s.currency || "ILS", account.currency, date);
          snap = { account_amount: fx.amount, account_currency: account.currency, account_fx_rate: fx.rate, account_fx_date: fx.rate_date, account_fx_source: fx.source };
        }
        const result = insert.run(
          s.amount, s.currency || "ILS", s.direction, s.category_id, date,
          `[auto] ${s.name} (${s.frequency})`, s.account_id ?? null, s.id,
          snap.account_amount, snap.account_currency, snap.account_fx_rate, snap.account_fx_date, snap.account_fx_source, now.toISOString(),
        );
        if (result.changes > 0) {
          created++;
          chargedNames.push(s.name);
        }
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
  if (created > 0) {
    logActivity(db, "transaction", "create", null,
      `Charged ${chargedNames.join(", ")} for ${month}`);
  }
  return NextResponse.json({ created });
}
