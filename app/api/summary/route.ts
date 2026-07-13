import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getConverter } from "@/lib/fx";

export const dynamic = "force-dynamic";

const r2 = (n: number) => Math.round(n * 100) / 100;

// GET /api/summary?month=YYYY-MM
// All monetary figures are converted to the base currency (settings.currency).
export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);
  const { base, toBase } = await getConverter();

  // Pull raw rows (with per-entry currency) and aggregate in base currency.
  const txRows = db.prepare(
    `SELECT t.amount, t.currency, t.direction, t.category_id,
            COALESCE(c.name,'Uncategorized') AS cat_name,
            COALESCE(c.color,'#888') AS cat_color
     FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
     WHERE substr(t.date,1,7)=?`
  ).all(month) as any[];

  let spent = 0;
  let earned = 0;
  const byCatMap = new Map<string, { name: string; color: string; total: number }>();
  const spentByCatId = new Map<number, number>();
  for (const t of txRows) {
    const val = toBase(t.amount, t.currency || base);
    if (t.direction === "expense") {
      spent += val;
      const key = t.category_id == null ? "null" : String(t.category_id);
      const cur = byCatMap.get(key) || { name: t.cat_name, color: t.cat_color, total: 0 };
      cur.total += val;
      byCatMap.set(key, cur);
      if (t.category_id != null) {
        spentByCatId.set(t.category_id, (spentByCatId.get(t.category_id) || 0) + val);
      }
    } else {
      earned += val;
    }
  }
  spent = r2(spent);
  earned = r2(earned);

  const by_category = [...byCatMap.values()]
    .map((r) => ({ name: r.name, color: r.color, total: r2(r.total) }))
    .sort((a, b) => b.total - a.total);

  const budgets = db.prepare("SELECT * FROM budgets WHERE month=?").all(month) as any[];
  const budgetRows = budgets.map((b: any) => {
    if (b.category_id == null) {
      return { category_id: null, category_name: "Overall", color: "#7c9cff", budget: r2(b.amount), actual: spent };
    }
    const cat = db.prepare("SELECT name,color FROM categories WHERE id=?").get(b.category_id) as any;
    return {
      category_id: b.category_id,
      category_name: cat?.name ?? "Unknown",
      color: cat?.color ?? "#888",
      budget: r2(b.amount),
      actual: r2(spentByCatId.get(b.category_id) || 0),
    };
  });

  const subs = db.prepare("SELECT amount, currency, frequency FROM subscriptions WHERE active=1").all() as any[];
  const recurring_monthly = r2(
    subs.reduce((acc: number, s: any) => {
      const monthly = s.frequency === "yearly" ? s.amount / 12 : s.amount;
      return acc + toBase(monthly, s.currency || base);
    }, 0)
  );

  return NextResponse.json({
    month,
    base,
    spent,
    earned,
    net: r2(earned - spent),
    remaining: r2(earned - spent),
    recurring_monthly,
    by_category,
    budgets: budgetRows,
  });
}
