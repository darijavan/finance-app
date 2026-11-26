import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getConverter } from "@/lib/fx";
import { dailyBaseConverter } from "@/lib/fx-historical";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/trends?months=12
// Per-month spending/earning in base currency at each transaction's own-date
// rate (ADR-0001), plus end-of-month net worth.
// Net worth values native balances at *current* FX rates (historical snapshots
// only fix each transaction's own account value, not a full past rate table).
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const nMonths = Math.min(Math.max(Number(searchParams.get("months")) || 12, 1), 60);
  const { base, toBase } = await getConverter();

  const months: string[] = [];
  const now = new Date();
  for (let i = nMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const firstMonth = months[0];

  const flow = new Map<string, { spent: number; earned: number }>();
  const flowRows = db.prepare(
    "SELECT substr(date,1,7) AS m, date, amount, currency, direction FROM transactions WHERE substr(date,1,7)>=?"
  ).all(firstMonth) as any[];
  const toBaseAt = await dailyBaseConverter(base, toBase, flowRows);
  for (const t of flowRows) {
    const cur = flow.get(t.m) || { spent: 0, earned: 0 };
    const val = toBaseAt(t.amount, t.currency, t.date);
    if (t.direction === "expense") cur.spent += val; else cur.earned += val;
    flow.set(t.m, cur);
  }

  // Native balance delta per (account, month), then cumulative across months.
  const accounts = db.prepare("SELECT id, currency FROM accounts").all() as any[];
  const delta = new Map<string, number>(); // "accountId|month" -> native delta
  const bump = (id: number, m: string, v: number) => {
    const k = `${id}|${m}`;
    delta.set(k, (delta.get(k) || 0) + v);
  };
  for (const t of db.prepare(
    "SELECT account_id, substr(date,1,7) AS m, amount, account_amount, direction FROM transactions WHERE account_id IS NOT NULL"
  ).all() as any[]) {
    const value = t.account_amount ?? t.amount;
    bump(t.account_id, t.m, t.direction === "expense" ? -value : value);
  }
  for (const x of db.prepare(
    "SELECT from_account, to_account, substr(date,1,7) AS m, amount, from_amount, to_amount FROM transfers"
  ).all() as any[]) {
    bump(x.from_account, x.m, -(x.from_amount ?? x.amount));
    bump(x.to_account, x.m, x.to_amount ?? x.amount);
  }

  // Opening balance: everything before the window.
  const running = new Map<number, number>();
  for (const [k, v] of delta) {
    const [id, m] = k.split("|");
    if (m < firstMonth) running.set(Number(id), (running.get(Number(id)) || 0) + v);
  }

  const out = months.map((m) => {
    for (const a of accounts) {
      const v = delta.get(`${a.id}|${m}`);
      if (v) running.set(a.id, (running.get(a.id) || 0) + v);
    }
    let netWorth = 0;
    for (const a of accounts) netWorth += toBase(running.get(a.id) || 0, a.currency);
    const f = flow.get(m) || { spent: 0, earned: 0 };
    
    return { month: m, spent: r2(f.spent), earned: r2(f.earned), net_worth: r2(netWorth) };
  });
  
  return NextResponse.json({ base, months: out });
}
