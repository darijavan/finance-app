import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import type { Currency } from "@/lib/currency";
import { snapshotConversion } from "@/lib/fx-historical";
import { money, currency, oneOf, isoDate, optionalId } from "@/lib/validate";

export const dynamic = "force-dynamic";

// POST /api/transactions/import
// body: { rows: [{ date, amount, direction, note }], currency, account_id?, category_id? }
// Inserts each valid row; rows matching an existing transaction on
// (date, amount, direction, note, account) are skipped as duplicates.
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  if (!Array.isArray(b.rows) || b.rows.length === 0) {
    

    return NextResponse.json({ error: "rows required" }, { status: 400 });
  }
  if (b.rows.length > 2000) 

  return NextResponse.json({ error: "too many rows (max 2000)" }, { status: 400 });
  const cur = currency(b.currency);
  const account_id = optionalId(b.account_id);
  const category_id = optionalId(b.category_id);
  if (cur == null || account_id === undefined || category_id === undefined) {
    

    return NextResponse.json({ error: "invalid currency, account, or category" }, { status: 400 });
  }
  let accountCurrency: Currency | null = null;
  if (account_id != null) {
    const acc = db.prepare("SELECT currency FROM accounts WHERE id=?").get(account_id) as any;
    if (!acc) 

    return NextResponse.json({ error: "account not found" }, { status: 404 });
    accountCurrency = acc.currency;
  }

  const dupe = db.prepare(
    "SELECT 1 FROM transactions WHERE date=? AND amount=? AND direction=? AND note=? AND account_id IS ? LIMIT 1"
  );
  const insert = db.prepare(
    `INSERT INTO transactions(amount,currency,direction,category_id,date,note,account_id,
      account_amount,account_currency,account_fx_rate,account_fx_date,account_fx_source,created_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  let skipped = 0, invalid = 0;
  const now = new Date().toISOString();
  const candidates: Array<{ amount: number; date: string; direction: "expense" | "income"; note: string; snap: any }> = [];
  for (const r of b.rows) {
    const amount = money(r.amount);
    const date = isoDate(r.date);
    if (amount == null || date == null) { invalid++; continue; }
    const direction = oneOf(r.direction, ["expense", "income"] as const, "expense");
    const note = String(r.note ?? "");
    if (dupe.get(date, amount, direction, note, account_id)) { skipped++; continue; }
    let snap: any = { amount: null, currency: null, rate: null, rate_date: null, source: null };
    if (account_id != null && accountCurrency != null) {
      const fx = await snapshotConversion(amount, cur, accountCurrency, date);
      snap = { amount: fx.amount, currency: accountCurrency, rate: fx.rate, rate_date: fx.rate_date, source: fx.source };
    }
    candidates.push({ amount, date, direction, note, snap });
  }
  let created = 0;
  try {
    db.exec("BEGIN IMMEDIATE");
    for (const { amount, date, direction, note, snap } of candidates) {
      if (dupe.get(date, amount, direction, note, account_id)) { skipped++; continue; }
      insert.run(amount, cur, direction, category_id, date, note, account_id,
        snap.amount, snap.currency, snap.rate, snap.rate_date, snap.source, now);
      created++;
    }
    if (created > 0) {
      logActivity(db, "transaction", "create", null, `Imported ${created} transaction(s) from CSV`);
    }
    db.exec("COMMIT");

    return NextResponse.json({ created, skipped, invalid });
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* no transaction to roll back */ }

    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
