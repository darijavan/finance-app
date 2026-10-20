import { NextRequest, NextResponse } from "next/server";
import { getDb, logActivity } from "@/lib/db";
import { money, currency, oneOf, isoDate, optionalId, intInRange } from "@/lib/validate";

export const dynamic = "force-dynamic";

// GET /api/subscriptions
// POST /api/subscriptions  body: { name, amount, direction?, category_id?, frequency?, day_of_month?, month_of_year?, start_date?, account_id?, active?, note? }
export async function GET() {
  const db = getDb();
  const rows = db.prepare(
    `SELECT s.*, c.name AS category_name, c.color AS category_color, a.name AS account_name
     FROM subscriptions s LEFT JOIN categories c ON s.category_id=c.id
     LEFT JOIN accounts a ON s.account_id=a.id
     ORDER BY s.active DESC, s.name`
  ).all() as any[];
  // Latest automatic charge per subscription — the UI flags a price change when
  // the current amount differs from what was last actually charged.
  const lastCharges = new Map<number, { id: number; amount: number; currency: string; account_amount: number | null; account_currency: string | null; date: string }>();
  for (const r of db.prepare(
    `SELECT id, subscription_id, amount, currency, account_amount, account_currency, date FROM transactions
     WHERE id IN (SELECT MAX(id) FROM transactions WHERE subscription_id IS NOT NULL GROUP BY subscription_id)`
  ).all() as any[]) lastCharges.set(r.subscription_id, r);
  for (const s of rows) {
    s.monthly_equivalent = s.frequency === "monthly" ? Math.round(s.amount * 100) / 100 : null;
    const lastCharge = lastCharges.get(s.id);
    s.last_charge_amount = lastCharge?.amount ?? null;
    s.last_charge_currency = lastCharge?.currency ?? null;
    s.last_charge_id = lastCharge?.id ?? null;
    s.last_charge_account_amount = lastCharge?.account_amount ?? null;
    s.last_charge_account_currency = lastCharge?.account_currency ?? null;
    s.last_charge_date = lastCharge?.date ?? null;
  }
  

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json();
  const name = (b.name ?? "").trim();
  const amount = money(b.amount);
  if (!name) 

  return NextResponse.json({ error: "name required" }, { status: 400 });
  if (amount == null) 

  return NextResponse.json({ error: "valid amount required" }, { status: 400 });
  const frequency = oneOf(b.frequency, ["monthly", "yearly"] as const, "monthly");
  const day_of_month = intInRange(b.day_of_month, 1, 28, 1);
  const month_of_year = frequency === "yearly" ? intInRange(b.month_of_year, 1, 12, 1) : null;
  const cur = currency(b.currency);
  const startDate = b.start_date ? isoDate(b.start_date) : null;
  const accountId = optionalId(b.account_id);
  const categoryId = optionalId(b.category_id);
  if (cur == null || (b.start_date && startDate == null) || accountId === undefined || categoryId === undefined) {
    

    return NextResponse.json({ error: "invalid currency, start date, category, or account" }, { status: 400 });
  }
  const info = db.prepare(
    `INSERT INTO subscriptions(name,amount,currency,direction,category_id,frequency,day_of_month,month_of_year,active,note,start_date,account_id)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    name, amount, cur,
    oneOf(b.direction, ["expense", "income"] as const, "expense"),
    categoryId, frequency, day_of_month, month_of_year,
    b.active === false ? 0 : 1, String(b.note ?? ""), startDate, accountId
  );
  logActivity(db, "subscription", "create", Number(info.lastInsertRowid),
    `Added subscription "${name}" (${amount} ${cur}, ${frequency})`);
  

  return NextResponse.json({ ok: true, id: info.lastInsertRowid }, { status: 201 });
}
