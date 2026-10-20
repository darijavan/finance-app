import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { nativeBalances } from "@/lib/balances";
import { money, isoDate, optionalId } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/goals -> goals with progress = linked account's native balance.
// Targets are in the linked account's currency.
export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT g.*, a.name AS account_name, a.currency AS currency
     FROM goals g JOIN accounts a ON g.account_id=a.id ORDER BY g.id`
  ).all() as any[];
  const native = nativeBalances(
    db.prepare("SELECT account_id, amount, account_amount, direction FROM transactions WHERE account_id IS NOT NULL").all() as any[],
    db.prepare("SELECT from_account, to_account, amount, from_amount, to_amount FROM transfers").all() as any[],
  );
  for (const g of rows) g.current = Math.round((native.get(g.account_id) || 0) * 100) / 100;
  
  return NextResponse.json(rows);
}

// POST /api/goals  body: { name, target_amount, account_id, target_date?, note? }
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const name = (b.name ?? "").trim();
  const target = money(b.target_amount);
  const account_id = optionalId(b.account_id);
  const target_date = b.target_date ? isoDate(b.target_date) : null;
  if (!name) 

  return NextResponse.json({ error: "name required" }, { status: 400 });
  if (target == null) 

  return NextResponse.json({ error: "valid target amount required" }, { status: 400 });
  if (account_id == null) 

  return NextResponse.json({ error: "account required" }, { status: 400 });
  if (b.target_date && target_date == null) 

  return NextResponse.json({ error: "invalid target date" }, { status: 400 });
  if (!db.prepare("SELECT 1 FROM accounts WHERE id=?").get(account_id)) {
    
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }
  const info = db.prepare(
    "INSERT INTO goals(name,target_amount,account_id,target_date,note,created_at) VALUES(?,?,?,?,?,?)"
  ).run(name, target, account_id, target_date, String(b.note ?? ""), new Date().toISOString());
  logActivity(db, "goal", "create", Number(info.lastInsertRowid), `Added savings goal "${name}" (${target})`);
  
  return NextResponse.json({ ok: true, id: info.lastInsertRowid }, { status: 201 });
}
