"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinance } from "./store";
import { API, getJSON, fmt, fmtCur } from "@/lib/client";
import { nextChargeDate } from "@/lib/subscription-due";
import type { TrendPoint } from "@/lib/types";

const CHART_W = 560;
const CHART_H = 200;
const PAD = { top: 14, right: 10, bottom: 22, left: 46 };

function monthLabel(m: string): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.slice(5, 7)) - 1];
}

// Shared scaffolding: recessive horizontal gridlines + y labels at 0/mid/max.
function Grid({ y0, yMax, yOf, sym }: { y0: number; yMax: number; yOf: (v: number) => number; sym: string }) {
  const ticks = [y0, (y0 + yMax) / 2, yMax];
  return (
    <g>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={CHART_W - PAD.right} y1={yOf(v)} y2={yOf(v)}
            stroke="var(--border)" strokeWidth={1} />
          <text x={PAD.left - 6} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">
            {fmt(Math.round(v), sym)}
          </text>
        </g>
      ))}
    </g>
  );
}

// Single-series net-worth line with crosshair hover; the title names the series.
function NetWorthChart({ points, sym }: { points: TrendPoint[]; sym: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = points.map((p) => p.net_worth);
  const yMax = Math.max(1, ...vals);
  const y0 = Math.min(0, ...vals);
  const xOf = (i: number) => PAD.left + (i / Math.max(1, points.length - 1)) * (CHART_W - PAD.left - PAD.right);
  const yOf = (v: number) => PAD.top + (1 - (v - y0) / (yMax - y0 || 1)) * (CHART_H - PAD.top - PAD.bottom);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i)},${yOf(p.net_worth)}`).join(" ");

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const i = Math.round(((x - PAD.left) / (CHART_W - PAD.left - PAD.right)) * (points.length - 1));
    setHover(Math.min(points.length - 1, Math.max(0, i)));
  };

  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: "auto" }} role="img"
      aria-label="Net worth by month" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <Grid y0={y0} yMax={yMax} yOf={yOf} sym={sym} />
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        (i === 0 || i === last || Number(p.month.slice(5, 7)) % 3 === 1) && (
          <text key={p.month} x={xOf(i)} y={CHART_H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {monthLabel(p.month)}
          </text>
        )
      ))}
      {/* direct label on the latest value */}
      {points.length > 0 && hover == null && (
        <text x={xOf(last)} y={yOf(points[last].net_worth) - 8} textAnchor="end" fontSize={12} fill="var(--text)">
          {fmt(points[last].net_worth, sym)}
        </text>
      )}
      {hover != null && (
        <g>
          <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.top} y2={CHART_H - PAD.bottom}
            stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={xOf(hover)} cy={yOf(points[hover].net_worth)} r={4}
            fill="var(--accent)" stroke="var(--panel)" strokeWidth={2} />
          <text x={xOf(hover) > CHART_W / 2 ? xOf(hover) - 8 : xOf(hover) + 8}
            y={PAD.top + 10} textAnchor={xOf(hover) > CHART_W / 2 ? "end" : "start"}
            fontSize={12} fill="var(--text)">
            {points[hover].month}: {fmt(points[hover].net_worth, sym)}
          </text>
        </g>
      )}
    </svg>
  );
}

// Grouped monthly bars: spent (red) and earned (green) — the app-wide
// expense/income colors, so chart marks match the numbers beside them.
function CashFlowChart({ points, sym }: { points: TrendPoint[]; sym: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const yMax = Math.max(1, ...points.flatMap((p) => [p.spent, p.earned]));
  const yOf = (v: number) => PAD.top + (1 - v / yMax) * (CHART_H - PAD.top - PAD.bottom);
  const slot = (CHART_W - PAD.left - PAD.right) / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(12, (slot - 6) / 2));

  return (
    <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: "100%", height: "auto" }} role="img"
      aria-label="Monthly spending and income" onMouseLeave={() => setHover(null)}>
      <Grid y0={0} yMax={yMax} yOf={yOf} sym={sym} />
      {points.map((p, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        return (
          <g key={p.month} onMouseEnter={() => setHover(i)}>
            {/* invisible hover target wider than the thin bars */}
            <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={CHART_H - PAD.top - PAD.bottom} fill="transparent" />
            <rect x={cx - barW - 1} y={yOf(p.spent)} width={barW} rx={2}
              height={Math.max(0, CHART_H - PAD.bottom - yOf(p.spent))} fill="var(--red)" />
            <rect x={cx + 1} y={yOf(p.earned)} width={barW} rx={2}
              height={Math.max(0, CHART_H - PAD.bottom - yOf(p.earned))} fill="var(--green)" />
            {(i === 0 || i === points.length - 1 || Number(p.month.slice(5, 7)) % 3 === 1) && (
              <text x={cx} y={CHART_H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {monthLabel(p.month)}
              </text>
            )}
          </g>
        );
      })}
      {hover != null && (
        <text x={CHART_W / 2} y={PAD.top + 10} textAnchor="middle" fontSize={12} fill="var(--text)">
          {points[hover].month} — spent {fmt(points[hover].spent, sym)} · earned {fmt(points[hover].earned, sym)}
        </text>
      )}
    </svg>
  );
}

export default function DashboardPage() {
  const { summary, sym, accounts, subscriptions, notify } = useFinance();
  const [trends, setTrends] = useState<TrendPoint[] | null>(null);

  useEffect(() => {
    getJSON<{ base: string; months: TrendPoint[] }>(`${API}/trends?months=12`)
      .then((r) => setTrends(r.months))
      .catch((e) => notify("Trends failed: " + String(e)));
  }, [notify]);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = useMemo(() => {
    const horizon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return subscriptions
      .filter((s) => s.active)
      .map((s) => ({ sub: s, date: nextChargeDate(s, today) }))
      .filter((u): u is { sub: typeof u.sub; date: string } => u.date != null && u.date <= horizon)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [subscriptions, today]);

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
          <h2>Net worth — last 12 months</h2>
          {trends == null ? <div className="empty">Loading…</div> : <NetWorthChart points={trends} sym={sym} />}
          <p className="muted" style={{ fontSize: 11, margin: "6px 0 0" }}>
            Native balances valued at current rates in {summary.base}.
          </p>
        </div>
        <div className="panel">
          <h2>Cash flow — last 12 months</h2>
          {trends == null ? <div className="empty">Loading…</div> : <CashFlowChart points={trends} sym={sym} />}
          <div className="row" style={{ gap: 14, marginTop: 6, fontSize: 12 }}>
            <span><span className="swatch" style={{ background: "var(--red)" }} /> Spent</span>
            <span><span className="swatch" style={{ background: "var(--green)" }} /> Earned</span>
          </div>
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
                  <span>{b.category_name}{b.rollover ? <span className="muted" style={{ fontSize: 11 }}> ↻</span> : null}</span>
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

      <div className="panel">
        <h2>Upcoming charges — next 30 days</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          Due subscriptions are charged automatically each night.
        </p>
        {upcoming.length === 0 && <div className="empty">Nothing due in the next 30 days.</div>}
        {upcoming.length > 0 && (
          <table>
            <thead><tr><th>Date</th><th>Subscription</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {upcoming.map(({ sub, date }) => (
                <tr key={sub.id}>
                  <td className={date <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) ? "yellow" : "muted"}>{date}</td>
                  <td>{sub.name}
                    {sub.last_charge_amount != null && sub.last_charge_amount !== sub.amount && (
                      <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}
                        title="Price changed since the last charge">
                        ⚠ was {fmtCur(sub.last_charge_amount, sub.currency)}
                      </span>
                    )}
                  </td>
                  <td className={`right ${sub.direction === "expense" ? "amount-expense" : "amount-income"}`}>
                    {sub.direction === "expense" ? "-" : "+"}{fmtCur(sub.amount, sub.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
