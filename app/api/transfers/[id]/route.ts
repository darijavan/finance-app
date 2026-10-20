import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import type { Currency } from "@/lib/currency";
import { snapshotConversion } from "@/lib/fx-historical";
import { currency, isoDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

// PUT recalculates both native-account sides from the transfer's dated quote.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const before = db.prepare("SELECT * FROM transfers WHERE id=?").get(id) as any;
  if (!before) 

  return NextResponse.json({ error: "transfer not found" }, { status: 404 });

  const body = await req.json();
  const postedFromAmount = "posted_from_amount" in body ? Math.abs(Number(body.posted_from_amount)) : undefined;
  if ("posted_from_amount" in body && (postedFromAmount == null || !Number.isFinite(postedFromAmount) || postedFromAmount <= 0)) {

    return NextResponse.json({ error: "valid posted origin debit required" }, { status: 400 });
  }
  const amount = Math.abs(Number(body.amount));
  const from_account = Number(body.from_account);
  const to_account = Number(body.to_account);
  const date = isoDate(body.date);
  const cur = currency(body.currency);
  if (!Number.isFinite(amount) || amount <= 0 || !from_account || !to_account || from_account === to_account || date == null || cur == null) {
    
    return NextResponse.json({ error: "valid amount, currency, date, and two different accounts required" }, { status: 400 });
  }
  const from = db.prepare("SELECT currency FROM accounts WHERE id=?").get(from_account) as { currency: Currency } | undefined;
  const to = db.prepare("SELECT currency FROM accounts WHERE id=?").get(to_account) as { currency: Currency } | undefined;
  if (!from || !to) 

  return NextResponse.json({ error: "account not found" }, { status: 404 });

  try {
    const [fromFx, toFx] = await Promise.all([
      snapshotConversion(amount, cur, from.currency, date),
      snapshotConversion(amount, cur, to.currency, date),
    ]);
    const hasPostedFromAmount = postedFromAmount != null;
    const fromSource = !hasPostedFromAmount ? fromFx.source : `provider_statement|${fromFx.source}`;
    const fromAmount = hasPostedFromAmount ? postedFromAmount : fromFx.amount;
    const fromRate = !hasPostedFromAmount ? fromFx.rate : postedFromAmount / amount;
    const previousDate = String(before.fx_rate_date ?? "").split("|")[1] || toFx.rate_date;
    const previousSource = String(before.fx_source ?? "").split("|")[1] || toFx.source;
    // Provider statements correct only the origin debit; retain the destination's immutable credit.
    const toAmount = !hasPostedFromAmount ? toFx.amount : before.to_amount;
    const toCurrency = !hasPostedFromAmount ? to.currency : before.to_currency;
    const toRate = !hasPostedFromAmount ? toFx.rate : before.to_fx_rate;
    const toDate = !hasPostedFromAmount ? toFx.rate_date : previousDate;
    const toSource = !hasPostedFromAmount ? toFx.source : previousSource;
    db.prepare(`UPDATE transfers SET amount=?, currency=?, from_account=?, to_account=?, date=?, note=?,
      from_amount=?, from_currency=?, to_amount=?, to_currency=?, from_fx_rate=?, to_fx_rate=?, fx_rate_date=?, fx_source=?
      WHERE id=?`).run(
      amount, cur, from_account, to_account, date, String(body.note ?? ""),
      fromAmount, from.currency, toAmount, toCurrency, fromRate, toRate,
      `${fromFx.rate_date}|${toDate}`, `${fromSource}|${toSource}`, id,
    );
    const row = db.prepare("SELECT * FROM transfers WHERE id=?").get(id);
    logActivity(db, "transfer", "update", id, postedFromAmount === undefined
      ? `Updated transfer #${id}`
      : `Corrected transfer #${id} origin debit from ${before.from_amount ?? "—"} ${before.from_currency ?? ""} to ${postedFromAmount} ${from.currency}`,
      postedFromAmount === undefined ? undefined : { before_from_amount: before.from_amount, posted_from_amount: postedFromAmount, from_currency: from.currency, from_fx_source: fromSource });
    
    return NextResponse.json(row);
  } catch (e) {
    
    return NextResponse.json({ error: String(e) }, { status: 422 });
  }
}

// DELETE /api/transfers/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const id = Number((await params).id);
  const row = db.prepare("SELECT * FROM transfers WHERE id=?").get(id) as any;
  if (!row) 

  return NextResponse.json({ ok: true, log_id: null });
  db.prepare("DELETE FROM transfers WHERE id=?").run(id);
  const logId = logActivity(db, "transfer", "delete", id,
    `Deleted transfer #${id} (${row.amount} ${row.currency || ""})`,
    { table: "transfers", ...row });
  
  return NextResponse.json({ ok: true, log_id: logId });
}
