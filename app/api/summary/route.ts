import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/summary?month=YYYY-MM
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  const totals = db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN direction='expense' THEN amount ELSE 0 END),0) AS spent,
       COALESCE(SUM(CASE WHEN direction='income' THEN amount ELSE 0 END),0) AS earned
     FROM transactions WHERE substr(date,1,7)=?`
  ).get(month) as { spent: number; earned: number };
  const spent = Math.round(totals.spent * 100) / 100;
  const earned = Math.round(totals.earned * 100) / 100;

  const byCat = db.prepare(
    `SELECT COALESCE(c.name,'Uncategorized') AS name, COALESCE(c.color,'#888') AS color, SUM(t.amount) AS total
     FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
     WHERE t.direction='expense' AND substr(t.date,1,7)=? GROUP BY c.id ORDER BY total DESC`
  ).all(month) as any[];
  const by_category = byCat.map(r => ({ name: r.name, color: r.color, total: Math.round(r.total * 100) / 100 }));

  const budgets = db.prepare("SELECT * FROM budgets WHERE month=?").all(month) as any[];
  const budgetRows = budgets.map((b: any) => {
    if (b.category_id == null) {
      return { category_id: null, category_name: "Overall", color: "#7c9cff", budget: Math.round(b.amount * 100) / 100, actual: spent };
    }
    const actual = (db.prepare(
      "SELECT COALESCE(SUM(amount),0) AS a FROM transactions WHERE direction='expense' AND category_id=? AND substr(date,1,7)=?"
    ).get(b.category_id, month) as any).a;
    const cat = db.prepare("SELECT name,color FROM categories WHERE id=?").get(b.category_id) as any;
    return { category_id: b.category_id, category_name: cat.name, color: cat.color, budget: Math.round(b.amount * 100) / 100, actual: Math.round(actual * 100) / 100 };
  });

  const subs = db.prepare("SELECT amount, frequency FROM subscriptions WHERE active=1").all() as any[];
  const recurring_monthly = Math.round(
    subs.reduce((acc: number, s: any) => acc + (s.frequency === "yearly" ? s.amount / 12 : s.amount), 0) * 100
  ) / 100;

  return NextResponse.json({
    month,
    spent,
    earned,
    net: Math.round((earned - spent) * 100) / 100,
    remaining: Math.round((earned - spent) * 100) / 100,
    recurring_monthly,
    by_category,
    budgets: budgetRows,
  });
}
