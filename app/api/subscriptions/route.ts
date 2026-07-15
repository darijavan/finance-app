import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/subscriptions
// POST /api/subscriptions  body: { name, amount, direction?, category_id?, frequency?, day_of_month?, month_of_year?, account_id?, active?, note? }
export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT s.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
     FROM subscriptions s LEFT JOIN categories c ON s.category_id=c.id
     LEFT JOIN accounts a ON s.account_id=a.id
     ORDER BY s.active DESC, s.name`
  ).all() as any[];
  for (const s of rows) {
    s.monthly_equivalent = s.frequency === "yearly" ? Math.round((s.amount / 12) * 100) / 100 : Math.round(s.amount * 100) / 100;
  }
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const name = (b.name ?? "").trim();
  const amount = Math.abs(Number(b.amount));
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "valid amount required" }, { status: 400 });
  const frequency = b.frequency === "yearly" ? "yearly" : "monthly";
  const day_of_month = Math.min(Math.max(Number(b.day_of_month) || 1, 1), 28);
  const month_of_year = b.month_of_year != null ? Number(b.month_of_year) : null;
  const currency = (b.currency || "ILS").toString().toUpperCase();
  const accountId = b.account_id != null ? Number(b.account_id) : null;
  const info = db.prepare(
    `INSERT INTO subscriptions(name,amount,currency,direction,category_id,frequency,day_of_month,month_of_year,active,note,account_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    name, amount, currency,
    b.direction === "income" ? "income" : "expense",
    b.category_id != null ? Number(b.category_id) : null,
    frequency, day_of_month, month_of_year,
    b.active === false ? 0 : 1, b.note || "", accountId
  );
  logActivity(db, "subscription", "create", Number(info.lastInsertRowid),
    `Added subscription "${name}" (${amount} ${currency}, ${frequency})`);
  return NextResponse.json({ ok: true, id: info.lastInsertRowid }, { status: 201 });
}
