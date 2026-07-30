import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import type { Currency } from "@/lib/currency";
import { snapshotConversion } from "@/lib/fx-historical";
import { money, currency, oneOf, isoDate, optionalId } from "@/lib/validate";

export const dynamic = "force-dynamic";

async function accountSnapshot(db: any, amount: number, currency: Currency, date: string, accountId: number | null) {
  if (accountId == null) 

  return { account_amount: null, account_currency: null, account_fx_rate: null, account_fx_date: null, account_fx_source: null };
  const account = db.prepare("SELECT currency FROM accounts WHERE id=?").get(accountId) as { currency: Currency } | undefined;
  if (!account) throw new Error("account not found");
  const fx = await snapshotConversion(amount, currency, account.currency, date);
  

  return { account_amount: fx.amount, account_currency: account.currency, account_fx_rate: fx.rate, account_fx_date: fx.rate_date, account_fx_source: fx.source };
}

// GET /api/transactions?month=YYYY-MM&direction=expense|income&category_id=N&account_id=N
// POST records both the entered amount and its immutable value in the credited/debited account currency.
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const wheres: string[] = [];
  const args: any[] = [];
  if (searchParams.get("month")) { wheres.push("substr(t.date,1,7)=?"); args.push(searchParams.get("month")); }
  if (searchParams.get("direction")) { wheres.push("t.direction=?"); args.push(searchParams.get("direction")); }
  if (searchParams.get("category_id")) { wheres.push("t.category_id=?"); args.push(Number(searchParams.get("category_id"))); }
  if (searchParams.get("account_id")) { wheres.push("t.account_id=?"); args.push(Number(searchParams.get("account_id"))); }
  if (searchParams.get("q")) { wheres.push("t.note LIKE ? COLLATE NOCASE"); args.push(`%${searchParams.get("q")}%`); }
  if (searchParams.get("from")) { wheres.push("t.date>=?"); args.push(searchParams.get("from")); }
  if (searchParams.get("to")) { wheres.push("t.date<=?"); args.push(searchParams.get("to")); }
  if (searchParams.get("min")) { wheres.push("t.amount>=?"); args.push(Number(searchParams.get("min"))); }
  if (searchParams.get("max")) { wheres.push("t.amount<=?"); args.push(Number(searchParams.get("max"))); }
  const where = wheres.length ? " WHERE " + wheres.join(" AND ") : "";
  const rows = (db.prepare(
    `SELECT t.*, t.subscription_id IS NOT NULL AS is_subscription_charge,
      c.name AS category_name, c.color AS category_color, a.name AS account_name
     FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
     LEFT JOIN accounts a ON t.account_id=a.id
     ${where} ORDER BY t.date DESC, t.id DESC`,
  ).all(...args) as any[]).map((row) => ({ ...row, is_subscription_charge: Boolean(row.is_subscription_charge) }));
  

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const amount = money(body.amount);
  if (amount == null) 

  return NextResponse.json({ error: "valid amount required" }, { status: 400 });
  const direction = oneOf(body.direction, ["expense", "income"] as const, "expense");
  const date = isoDate(body.date) ?? new Date().toISOString().slice(0, 10);
  const note = String(body.note ?? "");
  const category_id = optionalId(body.category_id);
  const account_id = optionalId(body.account_id);
  if (category_id === undefined || account_id === undefined) {
    

    return NextResponse.json({ error: "invalid category or account id" }, { status: 400 });
  }
  const cur = currency(body.currency);
  if (cur == null) 

  return NextResponse.json({ error: "invalid currency code" }, { status: 400 });
  try {
    const snap = await accountSnapshot(db, amount, cur, date, account_id);
    const info = db.prepare(
      `INSERT INTO transactions(amount,currency,direction,category_id,date,note,account_id,
        account_amount,account_currency,account_fx_rate,account_fx_date,account_fx_source,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(amount, cur, direction, category_id, date, note, account_id,
      snap.account_amount, snap.account_currency, snap.account_fx_rate, snap.account_fx_date, snap.account_fx_source, new Date().toISOString());
    const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(info.lastInsertRowid);
    logActivity(db, "transaction", "create", Number(info.lastInsertRowid),
      `Added ${direction} ${amount} ${cur}${note ? ` (${note})` : ""} for ${date}`);
    

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    

    return NextResponse.json({ error: String(e) }, { status: 422 });
  }
}
