import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { getConverter } from "@/lib/fx";

export const dynamic = "force-dynamic";

// Balances are held in each account's native currency. Snapshots prevent later FX changes
// from rewriting the value of a past transaction or either side of a transfer.
async function balancesByAccount(db: any, accounts: any[], toBase: (n: number, c: string) => number) {
  const native = new Map<number, number>();
  const byId = new Map(accounts.map((a: any) => [a.id, a]));
  const bump = (id: number, v: number) => native.set(id, (native.get(id) || 0) + v);
  for (const t of db.prepare("SELECT account_id, amount, currency, account_amount, account_currency, direction FROM transactions WHERE account_id IS NOT NULL").all() as any[]) {
    const value = t.account_amount ?? t.amount;
    bump(t.account_id, t.direction === "expense" ? -value : value);
  }
  for (const x of db.prepare("SELECT from_account, to_account, amount, from_amount, to_amount FROM transfers").all() as any[]) {
    bump(x.from_account, -(x.from_amount ?? x.amount));
    bump(x.to_account, x.to_amount ?? x.amount);
  }
  return accounts.map((a: any) => {
    const balance = Math.round((native.get(a.id) || 0) * 100) / 100;
    return { ...a, balance, base_balance: Math.round(toBase(balance, a.currency) * 100) / 100 };
  });
}

export async function GET() {
  const db = getDb();
  const { toBase } = await getConverter();
  const accounts = db.prepare("SELECT * FROM accounts ORDER BY active DESC, type, name").all() as any[];
  return NextResponse.json(await balancesByAccount(db, accounts, toBase));
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const type = new Set(["bank", "cash", "card", "other"]).has(b.type) ? b.type : "bank";
  const currency = (b.currency || "ILS").toString().toUpperCase();
  const info = db.prepare("INSERT INTO accounts(name,type,currency,active,note) VALUES(?,?,?,1,?)").run(name, type, currency, b.note || "");
  logActivity(db, "account", "create", Number(info.lastInsertRowid), `Added account "${name}" (${type})`);
  return NextResponse.json({ ok: true, id: info.lastInsertRowid }, { status: 201 });
}
