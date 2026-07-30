import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { snapshotConversion } from "@/lib/fx-historical";
import { money, currency, oneOf, isoDate, optionalId } from "@/lib/validate";
import { isSubscriptionCharge } from "@/lib/subscription-charge";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const before = db.prepare("SELECT * FROM transactions WHERE id=?").get(id) as any;
  if (!before) 

  return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  if (isSubscriptionCharge(before)) {

    return NextResponse.json({ error: "subscription charges are read-only" }, { status: 409 });
  }
  const body = await req.json();
  // Same validation rules as POST, applied only to the supplied fields.
  const amount = "amount" in body ? money(body.amount) : before.amount;
  const cur = "currency" in body ? currency(body.currency, before.currency) : before.currency;
  const date = "date" in body ? isoDate(body.date) : before.date;
  const account_id = "account_id" in body ? optionalId(body.account_id) : before.account_id;
  const category_id = "category_id" in body ? optionalId(body.category_id) : before.category_id;
  if (amount == null || cur == null || date == null || account_id === undefined || category_id === undefined) {
    

    return NextResponse.json({ error: "invalid amount, currency, date, category, or account" }, { status: 400 });
  }
  const next = { amount, currency: cur, date, account_id };
  const fields: string[] = [];
  const args: any[] = [];
  const direction = "direction" in body ? oneOf(body.direction, ["expense", "income"] as const, before.direction) : undefined;
  for (const [name, value] of Object.entries({ amount: next.amount, currency: next.currency, direction, category_id, account_id: next.account_id, date: next.date, note: "note" in body ? String(body.note ?? "") : undefined })) {
    const supplied = name === "amount" || name === "currency" || name === "account_id" || name === "date" || name in body;
    if (supplied) { fields.push(`${name}=?`); args.push(value); }
  }
  if (["amount", "currency", "account_id", "date"].some((x) => x in body)) {
    try {
      let snap: any = { amount: null, currency: null, rate: null, date: null, source: null };
      if (next.account_id != null) {
        const account = db.prepare("SELECT currency FROM accounts WHERE id=?").get(next.account_id) as any;
        if (!account) throw new Error("account not found");
        const fx = await snapshotConversion(next.amount, next.currency, account.currency, next.date);
        snap = { amount: fx.amount, currency: account.currency, rate: fx.rate, date: fx.rate_date, source: fx.source };
      }
      fields.push("account_amount=?", "account_currency=?", "account_fx_rate=?", "account_fx_date=?", "account_fx_source=?");
      args.push(snap.amount, snap.currency, snap.rate, snap.date, snap.source);
    } catch (e) { 

    return NextResponse.json({ error: String(e) }, { status: 422 }); }
  }
  if (!fields.length) 

  return NextResponse.json(before);
  args.push(id);
  db.prepare(`UPDATE transactions SET ${fields.join(", ")} WHERE id=?`).run(...args);
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(id);
  logActivity(db, "transaction", "update", id, `Updated transaction #${id} (${fields.join(", ")})`);
  

  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(id) as any;
  if (!row) 

  return NextResponse.json({ ok: true, log_id: null });
  if (isSubscriptionCharge(row)) {

    return NextResponse.json({ error: "subscription charges are read-only" }, { status: 409 });
  }
  db.prepare("DELETE FROM transactions WHERE id=?").run(id);
  const logId = logActivity(db, "transaction", "delete", id,
    `Deleted transaction #${id} (${row.direction} ${row.amount} ${row.currency || ""}, ${row.date})`, { table: "transactions", ...row });
  

  return NextResponse.json({ ok: true, log_id: logId });
}
