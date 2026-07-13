"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Category, Transaction, Subscription, Budget, Summary, Settings,
} from "@/lib/types";

const API = "/api";

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sendJSON<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const MONTHS_BACK = 12;

function monthList(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < MONTHS_BACK; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "transactions" | "subscriptions" | "budgets">("dashboard");
  const [month, setMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [settings, setSettings] = useState<Settings>({ currency: "ILS", currency_symbol: "₪" });
  const [toast, setToast] = useState<string | null>(null);

  const sym = settings.currency_symbol || "₪";
  const expenseCats = useMemo(() => categories.filter((c) => c.direction === "expense"), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.direction === "income"), [categories]);

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const loadAll = useCallback(async () => {
    try {
      const [cats, settings] = await Promise.all([
        getJSON<Category[]>(`${API}/categories`),
        getJSON<Settings>(`${API}/settings`),
      ]);
      setCategories(cats);
      setSettings(settings);
      await loadMonth(month, cats);
    } catch (e) { notify("Load failed: " + String(e)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const loadMonth = useCallback(async (m: string, cats?: Category[]) => {
    const [tx, subs, budgets, sum] = await Promise.all([
      getJSON<Transaction[]>(`${API}/transactions?month=${m}`),
      getJSON<Subscription[]>(`${API}/subscriptions`),
      getJSON<Budget[]>(`${API}/budgets?month=${m}`),
      getJSON<Summary>(`${API}/summary?month=${m}`),
    ]);
    setTransactions(tx);
    setSubscriptions(subs);
    setBudgets(budgets);
    setSummary(sum);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const changeMonth = (m: string) => { setMonth(m); loadMonth(m); };

  // ---- transaction add ----
  const [tAmount, setTAmount] = useState("");
  const [tDir, setTDir] = useState<"expense" | "income">("expense");
  const [tCat, setTCat] = useState<string>("");
  const [tDate, setTDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [tNote, setTNote] = useState("");

  const addTransaction = async () => {
    const amount = parseFloat(tAmount);
    if (!Number.isFinite(amount) || amount <= 0) return notify("Enter a valid amount");
    const cid = tCat ? Number(tCat) : null;
    await sendJSON(`${API}/transactions`, "POST", {
      amount, direction: tDir, category_id: cid, date: tDate, note: tNote,
    });
    setTAmount(""); setTNote(""); setTCat("");
    notify("Saved");
    loadMonth(month);
  };

  const deleteTransaction = async (id: number) => {
    await sendJSON(`${API}/transactions/${id}`, "DELETE");
    notify("Deleted");
    loadMonth(month);
  };

  // ---- subscription add ----
  const [sName, setSName] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sDir, setSDir] = useState<"expense" | "income">("expense");
  const [sFreq, setSFreq] = useState<"monthly" | "yearly">("monthly");
  const [sCat, setSCat] = useState<string>("");
  const [sDay, setSDay] = useState("1");
  const [sMonth, setSMonth] = useState("1");

  const addSubscription = async () => {
    const amount = parseFloat(sAmount);
    if (!sName.trim() || !Number.isFinite(amount) || amount <= 0) return notify("Enter name + amount");
    await sendJSON(`${API}/subscriptions`, "POST", {
      name: sName.trim(), amount, direction: sDir, frequency: sFreq,
      category_id: sCat ? Number(sCat) : null,
      day_of_month: Number(sDay), month_of_year: sFreq === "yearly" ? Number(sMonth) : null,
    });
    setSName(""); setSAmount(""); setSCat("");
    notify("Subscription added");
    loadMonth(month);
  };

  const deleteSubscription = async (id: number) => {
    await sendJSON(`${API}/subscriptions/${id}`, "DELETE");
    notify("Removed");
    loadMonth(month);
  };

  const chargeSubscriptions = async () => {
    const r = await sendJSON<{ created: number }>(`${API}/subscriptions/charge?month=${month}`, "POST");
    notify(`Charged ${r.created} subscription(s)`);
    loadMonth(month);
  };

  // ---- budget editor ----
  const [bCat, setBCat] = useState<string>(""); // "" = overall
  const [bAmount, setBAmount] = useState("");
  const setBudget = async () => {
    const amount = parseFloat(bAmount);
    if (!Number.isFinite(amount) || amount < 0) return notify("Enter a valid budget");
    await sendJSON(`${API}/budgets`, "PUT", {
      month, category_id: bCat ? Number(bCat) : null, amount,
    });
    setBAmount("");
    notify("Budget saved");
    loadMonth(month);
  };

  const deleteBudget = async (id: number) => {
    await sendJSON(`${API}/budgets/${id}`, "DELETE");
    notify("Budget removed");
    loadMonth(month);
  };

  // ---- currency ----
  const CURRENCIES = [
    { code: "ILS", symbol: "₪" }, { code: "USD", symbol: "$" },
    { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
    { code: "JPY", symbol: "¥" }, { code: "MGA", symbol: "Ar" },
  ];
  const setCurrency = async (code: string) => {
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    await sendJSON(`${API}/settings`, "PUT", { currency: cur.code, currency_symbol: cur.symbol });
    setSettings((s) => ({ ...s, currency: cur.code, currency_symbol: cur.symbol }));
    notify(`Currency set to ${cur.code}`);
  };

  // ---- category add ----
  const [cName, setCName] = useState("");
  const [cDir, setCDir] = useState<"expense" | "income">("expense");
  const addCategory = async () => {
    if (!cName.trim()) return notify("Enter category name");
    const r = await sendJSON<Category>(`${API}/categories`, "POST", { name: cName.trim(), direction: cDir });
    setCategories((p) => [...p, r]);
    setCName("");
    notify("Category added");
  };

  const catName = (id: number | null, direction: string) => {
    if (id == null) return null;
    const c = categories.find((x) => x.id === id);
    return c ? c.name : (direction === "income" ? "Income" : "Other");
  };
  const catColor = (id: number | null) => {
    const c = categories.find((x) => x.id === id);
    return c ? c.color : "#888";
  };

  const maxCat = summary ? Math.max(1, ...summary.by_category.map((c) => c.total)) : 1;

  return (
    <div className="app">
      <div className="topbar">
        <h1>💰 Finance</h1>
        <div className="month-picker">
          <label className="muted">Currency</label>
          <select value={settings.currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
            ))}
          </select>
          <label className="muted">Month</label>
          <select value={month} onChange={(e) => changeMonth(e.target.value)}>
            {monthList().map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="nav">
        {(["dashboard", "transactions", "subscriptions", "budgets"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "dashboard" && summary && (
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
      )}

      {tab === "transactions" && (
        <div className="panel">
          <h2>Add {tDir}</h2>
          <div className="row">
            <div className="field">
              <label>Type</label>
              <select value={tDir} onChange={(e) => { setTDir(e.target.value as any); setTCat(""); }}>
                <option value="expense">Expense</option>
                <option value="income">Income / Allowance</option>
              </select>
            </div>
            <div className="field">
              <label>Amount ({sym})</label>
              <input type="number" step="0.01" value={tAmount} onChange={(e) => setTAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="field">
              <label>Category</label>
              <select value={tCat} onChange={(e) => setTCat(e.target.value)}>
                <option value="">— none —</option>
                {(tDir === "expense" ? expenseCats : incomeCats).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Note</label>
              <input value={tNote} onChange={(e) => setTNote(e.target.value)} placeholder="optional" />
            </div>
            <button className="btn" onClick={addTransaction}>Add</button>
          </div>

          <h2 style={{ marginTop: 22 }}>This month</h2>
          {transactions.length === 0 && <div className="empty">Nothing logged yet.</div>}
          {transactions.length > 0 && (
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Note</th><th className="right">Amount</th><th></th></tr></thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>
                      <span className="tag" style={{ background: catColor(t.category_id) }}>
                        {catName(t.category_id, t.direction)}
                      </span>
                    </td>
                    <td className="muted">{t.note}</td>
                    <td className={`right ${t.direction === "expense" ? "amount-expense" : "amount-income"}`}>
                      {t.direction === "expense" ? "-" : "+"}{fmt(t.amount, sym)}
                    </td>
                    <td className="right"><button className="btn danger small" onClick={() => deleteTransaction(t.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="panel">
          <h2>Add subscription</h2>
          <div className="row">
            <div className="field">
              <label>Name</label>
              <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Netflix, Rent, Allowance…" />
            </div>
            <div className="field">
              <label>Amount ({sym})</label>
              <input type="number" step="0.01" value={sAmount} onChange={(e) => setSAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>Type</label>
              <select value={sDir} onChange={(e) => setSDir(e.target.value as any)}>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="field">
              <label>Frequency</label>
              <select value={sFreq} onChange={(e) => setSFreq(e.target.value as any)}>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={sCat} onChange={(e) => setSCat(e.target.value)}>
                <option value="">— none —</option>
                {(sDir === "expense" ? expenseCats : incomeCats).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Day of month</label>
              <input type="number" min="1" max="28" value={sDay} onChange={(e) => setSDay(e.target.value)} style={{ width: 70 }} />
            </div>
            {sFreq === "yearly" && (
              <div className="field">
                <label>Month (1-12)</label>
                <input type="number" min="1" max="12" value={sMonth} onChange={(e) => setSMonth(e.target.value)} style={{ width: 70 }} />
              </div>
            )}
            <button className="btn" onClick={addSubscription}>Add</button>
          </div>

          <h2 style={{ marginTop: 22 }}>Subscriptions</h2>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="btn secondary small" onClick={chargeSubscriptions}>
              ⚡ Charge this month ({month})
            </button>
            <span className="muted">Converts active subs into transactions for the month.</span>
          </div>
          {subscriptions.length === 0 && <div className="empty">No subscriptions yet.</div>}
          {subscriptions.length > 0 && (
            <table>
              <thead><tr><th>Name</th><th>Amount</th><th>Freq</th><th>~/mo</th><th>Cat</th><th></th></tr></thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                    <td>{s.name}</td>
                    <td className={s.direction === "expense" ? "amount-expense" : "amount-income"}>
                      {s.direction === "expense" ? "-" : "+"}{fmt(s.amount, sym)}
                    </td>
                    <td className="muted">{s.frequency}{s.frequency === "yearly" ? ` (m${s.month_of_year})` : ""}</td>
                    <td className="muted">{fmt(s.monthly_equivalent || 0, sym)}</td>
                    <td><span className="tag" style={{ background: s.category_color || "#888" }}>{s.category_name || "—"}</span></td>
                    <td className="right"><button className="btn danger small" onClick={() => deleteSubscription(s.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            Total recurring ≈ {fmt(
              subscriptions.filter((s) => s.active).reduce((a, s) => a + (s.frequency === "yearly" ? s.amount / 12 : s.amount), 0),
              sym
            )} / month
          </p>
        </div>
      )}

      {tab === "budgets" && (
        <div className="panel">
          <h2>Set budget</h2>
          <div className="row">
            <div className="field">
              <label>Category</label>
              <select value={bCat} onChange={(e) => setBCat(e.target.value)}>
                <option value="">Overall month</option>
                {expenseCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Budget ({sym})</label>
              <input type="number" step="0.01" value={bAmount} onChange={(e) => setBAmount(e.target.value)} />
            </div>
            <button className="btn" onClick={setBudget}>Save for {month}</button>
          </div>

          <h2 style={{ marginTop: 22 }}>Current budgets</h2>
          {budgets.filter((b) => b.amount > 0).length === 0 && <div className="empty">No budgets for {month}.</div>}
          {budgets.filter((b) => b.amount > 0).length > 0 && (
            <table>
              <thead><tr><th>Scope</th><th className="right">Budget</th><th></th></tr></thead>
              <tbody>
                {budgets.filter((b) => b.amount > 0).map((b) => (
                  <tr key={b.id}>
                    <td>{b.category_id == null ? "Overall" : (b.category_name || "—")}</td>
                    <td className="right">{fmt(b.amount, sym)}</td>
                    <td className="right"><button className="btn danger small" onClick={() => deleteBudget(b.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 style={{ marginTop: 22 }}>Manage categories</h2>
          <div className="row">
            <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="New category name" />
            <select value={cDir} onChange={(e) => setCDir(e.target.value as any)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <button className="btn secondary" onClick={addCategory}>Add category</button>
          </div>
          <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
            {categories.map((c) => (
              <span key={c.id} className="tag" style={{ background: c.color }}>{c.name} <span className="muted">({c.direction})</span></span>
            ))}
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
