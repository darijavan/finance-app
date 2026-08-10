import type { Currency } from "@/lib/currency";
import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { getConverter } from "@/lib/fx";
import { currency, isoMonth } from "@/lib/validate";
import { nativeBalances } from "@/lib/balances";

export const dynamic = "force-dynamic";

// Balances are held in each account's native currency. Snapshots prevent later FX changes
// from rewriting the value of a past transaction or either side of a transfer.
async function balancesByAccount(db: any, accounts: { id: number; currency: Currency }[], toBase: (n: number, c: Currency) => number, through?: string) {
  const native = nativeBalances(
    db.prepare("SELECT account_id, amount, account_amount, direction, date FROM transactions WHERE account_id IS NOT NULL").all() as any[],
    db.prepare("SELECT from_account, to_account, amount, from_amount, to_amount, date FROM transfers").all() as any[],
    through,
  );
  

  return accounts.map((a: any) => {
    const balance = Math.round((native.get(a.id) || 0) * 100) / 100;
    

    return { ...a, balance, base_balance: Math.round(toBase(balance, a.currency) * 100) / 100 };
  });
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const requestedMonth = new URL(req.url).searchParams.get("month");
  const month = isoMonth(requestedMonth);
  if (requestedMonth != null && month == null) {

    return NextResponse.json({ error: "valid month required" }, { status: 400 });
  }
  const { toBase } = await getConverter();
  const accounts = db.prepare("SELECT * FROM accounts ORDER BY active DESC, sort_order, id").all() as any[];
  

  return NextResponse.json(await balancesByAccount(db, accounts, toBase, month ? `${month}-31` : undefined));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const name = (b.name ?? "").trim();
  if (!name) 

  return NextResponse.json({ error: "name required" }, { status: 400 });
  const type = new Set(["bank", "cash", "card", "other"]).has(b.type) ? b.type : "bank";
  const cur = currency(b.currency);
  if (cur == null) 

  return NextResponse.json({ error: "invalid currency code" }, { status: 400 });
  const info = db.prepare("INSERT INTO accounts(name,type,currency,active,note,sort_order) VALUES(?,?,?,1,?,COALESCE((SELECT MAX(sort_order) + 1 FROM accounts), 1))").run(name, type, cur, String(b.note ?? ""));
  logActivity(db, "account", "create", Number(info.lastInsertRowid), `Added account "${name}" (${type})`);
  

  return NextResponse.json({ ok: true, id: info.lastInsertRowid }, { status: 201 });
}
