import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { snapshotConversion } from "@/lib/fx-historical";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const before = db.prepare("SELECT * FROM transactions WHERE id=?").get(id) as any;
  if (!before) return NextResponse.json({ error: "transaction not found" }, { status: 404 });
  const body = await req.json();
  const next = {
    amount: "amount" in body ? Math.abs(Number(body.amount)) : before.amount,
    currency: "currency" in body ? String(body.currency).toUpperCase() : before.currency,
    date: "date" in body ? body.date : before.date,
    account_id: "account_id" in body ? (body.account_id != null ? Number(body.account_id) : null) : before.account_id,
  };
  const fields: string[] = [];
  const args: any[] = [];
  for (const [name, value] of Object.entries({ amount: next.amount, currency: next.currency, direction: body.direction, category_id: body.category_id != null ? Number(body.category_id) : body.category_id, account_id: next.account_id, date: next.date, note: body.note })) {
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
    } catch (e) { return NextResponse.json({ error: String(e) }, { status: 422 }); }
  }
  if (!fields.length) return NextResponse.json(before);
  args.push(id);
  db.prepare(`UPDATE transactions SET ${fields.join(", ")} WHERE id=?`).run(...args);
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(id);
  logActivity(db, "transaction", "update", id, `Updated transaction #${id} (${fields.join(", ")})`);
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = getDb();
  const id = Number(params.id);
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(id) as any;
  if (!row) return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM transactions WHERE id=?").run(id);
  const logId = logActivity(db, "transaction", "delete", id,
    `Deleted transaction #${id} (${row.direction} ${row.amount} ${row.currency || ""}, ${row.date})`, { table: "transactions", ...row });
  return NextResponse.json({ ok: true, log_id: logId });
}
