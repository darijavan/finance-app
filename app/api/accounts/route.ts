import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { getConverter } from "@/lib/fx";

export const dynamic = "force-dynamic";

const ACC_TYPES = new Set(["bank", "cash", "card", "other"]);

// Compute each account's balance in base currency from transactions + transfers.
// Expenses/income on a transaction debit/credit that account; transfers move
// value from one account to another (no net change to total wealth).
async function balancesByAccount(db: any, toBase: (n: number, c: string) => number) {
  const out = new Map<number, number>();
  const bump = (id: number, v: number) => out.set(id, (out.get(id) || 0) + v);
  for (const t of db.prepare("SELECT account_id, amount, currency, direction FROM transactions WHERE account_id IS NOT NULL").all() as any[]) {
    const v = toBase(t.amount, t.currency || "ILS");
    bump(t.account_id, t.direction === "expense" ? -v : v);
  }
  for (const x of db.prepare("SELECT from_account, to_account, amount, currency FROM transfers").all() as any[]) {
    const v = toBase(x.amount, x.currency || "ILS");
    bump(x.from_account, -v);
    bump(x.to_account, v);
  }
  return out;
}

// GET /api/accounts   -> accounts with computed `balance` (base currency)
// POST /api/accounts  body: { name, type?, currency?, note? }
export async function GET() {
  const db = getDb();
  const { toBase } = await getConverter();
  const rows = db.prepare("SELECT * FROM accounts ORDER BY active DESC, type, name").all() as any[];
  const bal = await balancesByAccount(db, toBase);
  for (const a of rows) a.balance = Math.round((bal.get(a.id) || 0) * 100) / 100;
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const type = ACC_TYPES.has(b.type) ? b.type : "bank";
  const currency = (b.currency || "ILS").toString().toUpperCase();
  const info = db.prepare(
    "INSERT INTO accounts(name,type,currency,active,note) VALUES(?,?,?,1,?)"
  ).run(name, type, currency, b.note || "");
  logActivity(db, "account", "create", Number(info.lastInsertRowid), `Added account "${name}" (${type})`);
  return NextResponse.json({ ok: true, id: info.lastInsertRowid }, { status: 201 });
}
