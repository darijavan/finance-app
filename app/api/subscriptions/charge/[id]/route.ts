import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { money } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PUT /api/subscriptions/charge/:id  body: { posted_account_amount }
// Correct only the actual debit, leaving the subscription price and charge date immutable.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const before = db.prepare("SELECT * FROM transactions WHERE id=? AND subscription_id IS NOT NULL").get(id) as any;
  if (!before) {

    return NextResponse.json({ error: "subscription charge not found" }, { status: 404 });
  }
  const postedAccountAmount = money((await req.json()).posted_account_amount);
  if (postedAccountAmount == null) {

    return NextResponse.json({ error: "valid posted account amount required" }, { status: 400 });
  }
  if (before.account_id == null) {

    return NextResponse.json({ error: "an account is required for a posted debit correction" }, { status: 400 });
  }
  const account = db.prepare("SELECT currency FROM accounts WHERE id=?").get(before.account_id) as { currency: string } | undefined;
  if (!account) {

    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }
  db.prepare(
    `UPDATE transactions SET account_amount=?, account_currency=?, account_fx_rate=?, account_fx_date=?, account_fx_source=?
     WHERE id=?`,
  ).run(postedAccountAmount, account.currency, postedAccountAmount / before.amount, before.date, "provider_statement", id);
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(id);
  logActivity(db, "transaction", "update", id,
    `Corrected subscription charge #${id} posted debit from ${before.account_amount ?? "—"} ${before.account_currency ?? ""} to ${postedAccountAmount} ${account.currency}`,
    { before_account_amount: before.account_amount, posted_account_amount: postedAccountAmount, account_currency: account.currency, account_fx_source: "provider_statement" });

  return NextResponse.json(row);
}
