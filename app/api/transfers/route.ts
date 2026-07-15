import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/transfers?limit=N
// POST /api/transfers  body: { amount, from_account, to_account, date?, note?, currency? }
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 200);
  const rows = db.prepare(
    `SELECT t.*, f.name AS from_name, f.type AS from_type,
            g.name AS to_name, g.type AS to_type
     FROM transfers t
     LEFT JOIN accounts f ON t.from_account=f.id
     LEFT JOIN accounts g ON t.to_account=g.id
     ORDER BY t.date DESC, t.id DESC LIMIT ?`
  ).all(limit) as any[];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const amount = Math.abs(Number(b.amount));
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "valid amount required" }, { status: 400 });
  const from_account = Number(b.from_account);
  const to_account = Number(b.to_account);
  if (!from_account || !to_account || from_account === to_account) {
    return NextResponse.json({ error: "from/to accounts required and must differ" }, { status: 400 });
  }
  const exists = (id: number) => (db.prepare("SELECT id FROM accounts WHERE id=?").get(id) as any);
  if (!exists(from_account) || !exists(to_account)) {
    return NextResponse.json({ error: "account not found" }, { status: 404 });
  }
  const date = b.date || new Date().toISOString().slice(0, 10);
  const note = b.note || "";
  const currency = (b.currency || "ILS").toString().toUpperCase();
  const info = db.prepare(
    "INSERT INTO transfers(amount,currency,from_account,to_account,date,note,created_at) VALUES(?,?,?,?,?,?,?)"
  ).run(amount, currency, from_account, to_account, date, note, new Date().toISOString());
  const row = db.prepare("SELECT * FROM transfers WHERE id=?").get(info.lastInsertRowid);
  logActivity(db, "transfer", "create", Number(info.lastInsertRowid),
    `Transferred ${amount} ${currency} (${from_account} -> ${to_account}) on ${date}`);
  return NextResponse.json(row, { status: 201 });
}
