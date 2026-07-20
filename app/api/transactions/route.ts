import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { snapshotConversion } from "@/lib/fx-historical";

export const dynamic = "force-dynamic";

async function accountSnapshot(db: any, amount: number, currency: string, date: string, accountId: number | null) {
  if (accountId == null) return { account_amount: null, account_currency: null, account_fx_rate: null, account_fx_date: null, account_fx_source: null };
  const account = db.prepare("SELECT currency FROM accounts WHERE id=?").get(accountId) as { currency: string } | undefined;
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
  const where = wheres.length ? " WHERE " + wheres.join(" AND ") : "";
  const rows = db.prepare(
    `SELECT t.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
     FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
     LEFT JOIN accounts a ON t.account_id=a.id
     ${where} ORDER BY t.date DESC, t.id DESC`,
  ).all(...args);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  const amount = Math.abs(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "valid amount required" }, { status: 400 });
  const direction = body.direction === "income" ? "income" : "expense";
  const date = body.date || new Date().toISOString().slice(0, 10);
  const note = body.note || "";
  const category_id = body.category_id != null ? Number(body.category_id) : null;
  const account_id = body.account_id != null ? Number(body.account_id) : null;
  const currency = (body.currency || "ILS").toString().toUpperCase();
  try {
    const snap = await accountSnapshot(db, amount, currency, date, account_id);
    const info = db.prepare(
      `INSERT INTO transactions(amount,currency,direction,category_id,date,note,account_id,
        account_amount,account_currency,account_fx_rate,account_fx_date,account_fx_source,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(amount, currency, direction, category_id, date, note, account_id,
      snap.account_amount, snap.account_currency, snap.account_fx_rate, snap.account_fx_date, snap.account_fx_source, new Date().toISOString());
    const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(info.lastInsertRowid);
    logActivity(db, "transaction", "create", Number(info.lastInsertRowid),
      `Added ${direction} ${amount} ${currency}${note ? ` (${note})` : ""} for ${date}`);
    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 422 });
  }
}
