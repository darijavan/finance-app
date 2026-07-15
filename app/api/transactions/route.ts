import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/transactions?month=YYYY-MM&direction=expense|income&category_id=N&account_id=N
// POST /api/transactions  body: { amount, direction, category_id?, date?, note?, account_id? }
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
     ${where} ORDER BY t.date DESC, t.id DESC`
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
  const info = db.prepare(
    "INSERT INTO transactions(amount,currency,direction,category_id,date,note,account_id,created_at) VALUES(?,?,?,?,?,?,?,?)"
  ).run(amount, currency, direction, category_id, date, note, account_id, new Date().toISOString());
  const row = db.prepare("SELECT * FROM transactions WHERE id=?").get(info.lastInsertRowid);
  logActivity(db, "transaction", "create", Number(info.lastInsertRowid),
    `Added ${direction} ${amount} ${currency}${note ? ` (${note})` : ""} for ${date}`);
  return NextResponse.json(row, { status: 201 });
}
