"use client";

import { useFinance } from "./store";
import { fmt } from "@/lib/client";

export default function DashboardPage() {
  const { summary, sym, accounts } = useFinance();
  if (!summary) return <div className="empty">Loading…</div>;

  // Sum in base currency — native balances can't be added across currencies.
  const netWorth = accounts.reduce((acc, a) => acc + (a.base_balance || 0), 0);
  const maxCat = summary.by_category.length
    ? Math.max(1, ...summary.by_category.map((c) => c.total))
    : 1;

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="label">Spent</div>
          <div className="value red">{fmt(summary.spent, sym)}</div>
        </div>
        <div className="card">
          <div className="label">Earned</div>
          <div className="value green">{fmt(summary.earned, sym)}</div>
        </div>
        <div className="card">
          <div className="label">Net</div>
          <div className={`value ${summary.net >= 0 ? "green" : "red"}`}>{fmt(summary.net, sym)}</div>
        </div>
        <div className="card">
          <div className="label">Recurring / mo</div>
          <div className="value yellow">{fmt(summary.recurring_monthly, sym)}</div>
        </div>
        <div className="card">
          <div className="label">Net worth</div>
          <div className={`value ${netWorth >= 0 ? "green" : "red"}`}>{fmt(netWorth, sym)}</div>
        </div>
      </div>

      <div className="grid2">
        <div className="panel">
          <h2>Spending by category</h2>
          {summary.by_category.length === 0 && <div className="empty">No expenses this month.</div>}
          {summary.by_category.map((c) => (
            <div key={c.name} className="budget-row">
              <div className="top">
                <span>{c.name}</span>
                <span>{fmt(c.total, sym)}</span>
              </div>
              <div className="bar">
                <span style={{ width: `${(c.total / maxCat) * 100}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Budgets</h2>
          {summary.budgets.length === 0 && <div className="empty">No budgets set. Use the Budgets tab.</div>}
          {summary.budgets.map((b, i) => {
            const pct = b.budget > 0 ? (b.actual / b.budget) * 100 : 0;
            const over = b.actual > b.budget;
            return (
              <div key={i} className="budget-row">
                <div className="top">
                  <span>{b.category_name}</span>
                  <span className={over ? "amount-expense" : "muted"}>
                    {fmt(b.actual, sym)} / {fmt(b.budget, sym)} ({Math.round(pct)}%)
                  </span>
                </div>
                <div className="bar">
                  <span style={{ width: `${Math.min(100, pct)}%`, background: over ? "var(--red)" : b.color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
