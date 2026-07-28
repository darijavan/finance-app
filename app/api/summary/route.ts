import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getConverter } from "@/lib/fx";
import { scheduledDateInMonth } from "@/lib/subscription-due";

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

  // Rollover budgets: unused amount from the previous month's budget carries forward.
  const spentInMonth = (catId: number | null, m: string): number => {
    const rows = (catId == null
      ? db.prepare("SELECT amount, currency FROM transactions WHERE substr(date,1,7)=? AND direction='expense'").all(m)
      : db.prepare("SELECT amount, currency FROM transactions WHERE substr(date,1,7)=? AND direction='expense' AND category_id=?").all(m, catId)) as any[];
    

    return rows.reduce((acc, r) => acc + toBase(r.amount, r.currency || base), 0);
  };
  const prevMonth = (m: string) => {
    const [y, mm] = m.split("-").map(Number);
    const d = new Date(y, mm - 2, 1);
    

    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  // ponytail: positive carryover only, chain capped at 12 months back.
  const effectiveBudget = (b: any, depth = 0): number => {
    if (!b.rollover || depth >= 12) 

    return b.amount;
    const pm = prevMonth(b.month);
    const prev = db.prepare("SELECT * FROM budgets WHERE month=? AND category_id IS ?").get(pm, b.category_id) as any;
    if (!prev) 

    return b.amount;
    const leftover = effectiveBudget(prev, depth + 1) - spentInMonth(b.category_id, pm);
    

    return b.amount + Math.max(0, leftover);
  };

  const budgets = db.prepare("SELECT * FROM budgets WHERE month=?").all(month) as any[];
  const budgetRows = budgets.map((b: any) => {
    if (b.category_id == null) {
      

      return { category_id: null, category_name: "Overall", color: "#7c9cff", budget: r2(effectiveBudget(b)), actual: spent, rollover: !!b.rollover };
    }
    const cat = db.prepare("SELECT name,color FROM categories WHERE id=?").get(b.category_id) as any;
    

    return {
      category_id: b.category_id,
      category_name: cat?.name ?? "Unknown",
      color: cat?.color ?? "#888",
      budget: r2(effectiveBudget(b)),
      actual: r2(spentByCatId.get(b.category_id) || 0),
      rollover: !!b.rollover,
    };
  });

  const subs = db.prepare(
    "SELECT id, name, amount, currency, direction, frequency, day_of_month, month_of_year, start_date FROM subscriptions WHERE active=1",
  ).all() as any[];
  const recurring_monthly = r2(
    subs.reduce((acc: number, s: any) => {
      

      return s.frequency === "monthly" ? acc + toBase(s.amount, s.currency || base) : acc;
    }, 0)
  );

  // Paid subscription transactions carry their source id, letting this show
  // only the current month's unpaid expense subscriptions.
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const charged = new Set((db.prepare(
    "SELECT DISTINCT subscription_id FROM transactions WHERE subscription_id IS NOT NULL AND substr(date,1,7)=?",
  ).all(currentMonth) as any[]).map((t) => t.subscription_id));
  const due_subscriptions = subs
    .filter((s) => s.direction === "expense" && !charged.has(s.id))
    .map((s) => ({ ...s, date: scheduledDateInMonth(s, currentMonth) }))
    .filter((s): s is typeof s & { date: string } => s.date != null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ id: s.id, name: s.name, amount: s.amount, currency: s.currency || base, date: s.date, overdue: s.date < today }));
  const remaining_subscriptions = r2(due_subscriptions.reduce(
    (total, s) => total + toBase(s.amount, s.currency), 0,
  ));

  return NextResponse.json({
    month,
    base,
    spent,
    earned,
    net: r2(earned - spent),
    remaining: r2(earned - spent),
    recurring_monthly,
    remaining_subscriptions,
    due_subscriptions,
    by_category,
    budgets: budgetRows,
  });
}
