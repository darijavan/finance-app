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
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  const pending: { sub: any; date: string; snap: any }[] = [];
  try {
    // Fetch and cache dated quotes before the ledger write transaction.
    for (const sub of subs) {
      const date = chargeDate(sub, month, today);
      if (date == null) continue;
      const alreadyCharged = db.prepare(
        "SELECT 1 FROM transactions WHERE subscription_id=? AND substr(date, 1, 7)=?",
      ).get(sub.id, month);
      if (alreadyCharged) continue;
      let snap: any = { account_amount: null, account_currency: null, account_fx_rate: null, account_fx_date: null, account_fx_source: null };
      if (sub.account_id != null) {
        const account = db.prepare("SELECT currency FROM accounts WHERE id=?").get(sub.account_id) as any;
        if (!account) throw new Error(`subscription account ${sub.account_id} not found`);
        const fx = await snapshotConversion(sub.amount, sub.currency || "ILS", account.currency, date);
        snap = { account_amount: fx.amount, account_currency: account.currency, account_fx_rate: fx.rate, account_fx_date: fx.rate_date, account_fx_source: fx.source };
      }
      pending.push({ sub, date, snap });
    }

    db.exec("BEGIN IMMEDIATE");
    let created = 0;
    const chargedNames: string[] = [];
    for (const { sub, date, snap } of pending) {
      // Recheck once the transaction holds the writer lock, keeping the endpoint idempotent.
      const alreadyCharged = db.prepare(
        "SELECT 1 FROM transactions WHERE subscription_id=? AND substr(date, 1, 7)=?",
      ).get(sub.id, month);
      if (alreadyCharged) continue;
      const result = insert.run(
        sub.amount, sub.currency || "ILS", sub.direction, sub.category_id, date,
        `[auto] ${sub.name} (${sub.frequency})`, sub.account_id ?? null, sub.id,
        snap.account_amount, snap.account_currency, snap.account_fx_rate, snap.account_fx_date, snap.account_fx_source, now.toISOString(),
      );
      if (result.changes > 0) {
        created++;
        chargedNames.push(sub.name);
      }
    }
    db.exec("COMMIT");
    if (created > 0) {
      logActivity(db, "transaction", "create", null,
        `Charged ${chargedNames.join(", ")} for ${month}`);
    }

    return NextResponse.json({ created });
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {}

    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
