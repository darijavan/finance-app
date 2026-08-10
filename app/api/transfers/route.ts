import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import type { Currency } from "@/lib/currency";
import { snapshotConversion } from "@/lib/fx-historical";
import { currency, isoDate, isoMonth } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/transfers?limit=N
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const requestedMonth = searchParams.get("month");
  const month = isoMonth(requestedMonth);
  if (requestedMonth != null && month == null) {

    return NextResponse.json({ error: "valid month required" }, { status: 400 });
  }
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const where = month ? "WHERE substr(t.date,1,7)=?" : "";
  const args = month ? [month, limit] : [limit];
  const rows = db.prepare(
    `SELECT t.*, f.name AS from_name, f.type AS from_type,
            g.name AS to_name, g.type AS to_type
     FROM transfers t
     LEFT JOIN accounts f ON t.from_account=f.id
     LEFT JOIN accounts g ON t.to_account=g.id
     ${where} ORDER BY t.date DESC, t.id DESC LIMIT ?`,
  ).all(...args) as any[];
  

  return NextResponse.json(rows);
}

// POST snapshots both sides in their respective account currencies using the dated quote.
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const amount = Math.abs(Number(b.amount));
  if (!Number.isFinite(amount) || amount <= 0) 

  return NextResponse.json({ error: "valid amount required" }, { status: 400 });
  const from_account = Number(b.from_account);
  const to_account = Number(b.to_account);
  if (!from_account || !to_account || from_account === to_account) {
    

    return NextResponse.json({ error: "from/to accounts required and must differ" }, { status: 400 });
  }
  const from = db.prepare("SELECT currency FROM accounts WHERE id=?").get(from_account) as { currency: Currency } | undefined;
  const to = db.prepare("SELECT currency FROM accounts WHERE id=?").get(to_account) as { currency: Currency } | undefined;
  if (!from || !to) 

  return NextResponse.json({ error: "account not found" }, { status: 404 });
  const date = isoDate(b.date) ?? new Date().toISOString().slice(0, 10);
  const note = String(b.note ?? "");
  const cur = currency(b.currency);
  if (cur == null) 

  return NextResponse.json({ error: "invalid currency code" }, { status: 400 });
  try {
    const [fromFx, toFx] = await Promise.all([
      snapshotConversion(amount, cur, from.currency, date),
      snapshotConversion(amount, cur, to.currency, date),
    ]);
    const info = db.prepare(
      `INSERT INTO transfers(amount,currency,from_account,to_account,date,note,
        from_amount,from_currency,to_amount,to_currency,from_fx_rate,to_fx_rate,fx_rate_date,fx_source,created_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(amount, cur, from_account, to_account, date, note,
      fromFx.amount, from.currency, toFx.amount, to.currency, fromFx.rate, toFx.rate,
      `${fromFx.rate_date}|${toFx.rate_date}`, `${fromFx.source}|${toFx.source}`, new Date().toISOString());
    const row = db.prepare("SELECT * FROM transfers WHERE id=?").get(info.lastInsertRowid);
    logActivity(db, "transfer", "create", Number(info.lastInsertRowid),
      `Transferred ${fromFx.amount} ${from.currency} → ${toFx.amount} ${to.currency} on ${date}`);
    

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    

    return NextResponse.json({ error: String(e) }, { status: 422 });
  }
}
