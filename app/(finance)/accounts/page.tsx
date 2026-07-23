"use client";

import { useCallback, useEffect, useState } from "react";
import { useFinance } from "../store";
import { API, getJSON, sendJSON, fmt, fmtCur, CURRENCIES } from "@/lib/client";
import type { Account, Transfer, AccountType, Goal } from "@/lib/types";

const TYPES: { v: AccountType; label: string }[] = [
  { v: "bank", label: "Bank" },
  { v: "cash", label: "Cash" },
  { v: "card", label: "Prepaid card" },
  { v: "other", label: "Other" },
];

export default function AccountsPage() {
  const {
    settings, accounts, transfers, reload, notify, confirm, undo,
  } = useFinance();

  const [aName, setAName] = useState("");
  const [aType, setAType] = useState<AccountType>("bank");
  const [aCur, setACur] = useState<string>(settings.currency || "ILS");

  const [tAmount, setTAmount] = useState("");
  const [tFrom, setTFrom] = useState<string>("");
  const [tTo, setTTo] = useState<string>("");
  const [tDate, setTDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [tNote, setTNote] = useState("");
  const [tCur, setTCur] = useState<string>(settings.currency || "ILS");

  const total = accounts.reduce((acc, a) => acc + (a.base_balance || 0), 0);

  const saveAccount = async () => {
    if (!aName.trim()) return notify("Enter a name");
    await sendJSON(`${API}/accounts`, "POST", { name: aName.trim(), type: aType, currency: aCur });
    notify("Account added");
    setAName(""); setAType("bank"); setACur(settings.currency || "ILS");
    reload();
  };

  const deleteAccount = async (id: number) => {
    const ok = await confirm({
      title: "Delete account?",
      message: "Only accounts with no transactions, transfers, or subscriptions can be deleted.",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    const r = await sendJSON<{ ok: boolean; log_id: number | null; error?: string }>(`${API}/accounts/${id}`, "DELETE");
    if ((r as any).error) { notify((r as any).error); return; }
    notify("Deleted");
    reload();
    if (r.log_id != null) undo({ message: "Account deleted.", logId: r.log_id });
  };

  const saveTransfer = async () => {
    const amount = parseFloat(tAmount);
    if (!Number.isFinite(amount) || amount <= 0) return notify("Enter a valid amount");
    if (!tFrom || !tTo || tFrom === tTo) return notify("Pick two different accounts");
    const r = await sendJSON<{ ok: boolean; error?: string }>(`${API}/transfers`, "POST", {
      amount, from_account: Number(tFrom), to_account: Number(tTo),
      date: tDate, note: tNote, currency: tCur,
    });
    if ((r as any).error) { notify((r as any).error); return; }
    notify("Transfer recorded");
    setTAmount(""); setTNote(""); setTFrom(""); setTTo(""); setTCur(settings.currency || "ILS");
    reload();
  };

  const deleteTransfer = async (id: number) => {
    const ok = await confirm({
      title: "Delete transfer?",
      message: "This reverses the balance move. You can undo it from the bottom bar right after.",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    const r = await sendJSON<{ ok: boolean; log_id: number | null }>(`${API}/transfers/${id}`, "DELETE");
    notify("Deleted");
    reload();
    if (r.log_id != null) undo({ message: "Transfer deleted.", logId: r.log_id });
  };

  const accName = (id?: number | null) => accounts.find((a) => a.id === id)?.name || "?";

  // Savings goals — target is in the linked account's currency; progress is
  // that account's balance.
  const [goals, setGoals] = useState<Goal[]>([]);
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gAccount, setGAccount] = useState("");
  const [gDate, setGDate] = useState("");

  const loadGoals = useCallback(async () => {
    try { setGoals(await getJSON<Goal[]>(`${API}/goals`)); }
    catch { /* non-fatal; section just stays empty */ }
  }, []);
  useEffect(() => { loadGoals(); }, [loadGoals, accounts]);

  const saveGoal = async () => {
    const target = parseFloat(gTarget);
    if (!gName.trim() || !Number.isFinite(target) || target <= 0) return notify("Enter goal name + target");
    if (!gAccount) return notify("Pick the account to save into");
    await sendJSON(`${API}/goals`, "POST", {
      name: gName.trim(), target_amount: target, account_id: Number(gAccount),
      target_date: gDate || null,
    });
    notify("Goal added");
    setGName(""); setGTarget(""); setGAccount(""); setGDate("");
    loadGoals();
  };

  const deleteGoal = async (id: number) => {
    const ok = await confirm({
      title: "Delete goal?",
      message: "This removes the goal (the account and its money are untouched).",
      confirmLabel: "Delete", danger: true,
    });
    if (!ok) return;
    const r = await sendJSON<{ ok: boolean; log_id: number | null }>(`${API}/goals/${id}`, "DELETE");
    notify("Goal deleted");
    loadGoals();
    if (r.log_id != null) undo({ message: "Goal deleted.", logId: r.log_id });
  };

  return (
    <>
    <div className="panel">
      <h2>Accounts</h2>
      <p className="muted" style={{ fontSize: 12 }}>
        Track where money lives. Use <strong>Transfer</strong> for ATM withdrawals (Bank → Cash) or topping up a prepaid card (Bank → Card) — those are not expenses, just moves between accounts.
      </p>

      {accounts.length === 0 ? (
        <div className="empty">No accounts yet — add your first one below.</div>
      ) : (
        <div className="cards" style={{ marginBottom: 18 }}>
          {accounts.map((a) => (
            <div className="card" key={a.id}>
              <div className="card-head">
                <div className="label">{a.name} <span className="muted">({a.type})</span></div>
                <button
                  className="icon-btn danger"
                  title="Delete"
                  aria-label={`Delete account ${a.name}`}
                  onClick={() => deleteAccount(a.id)}
                >✕</button>
              </div>
              <div className={`value ${a.balance! >= 0 ? "green" : "red"}`}>{fmtCur(a.balance || 0, a.currency)}</div>
            </div>
          ))}
          <div className="card">
            <div className="label">Net worth</div>
            <div className={`value ${total >= 0 ? "green" : "red"}`}>{fmt(total, settings.currency_symbol || "₪")}</div>
          </div>
        </div>
      )}

      <h2>Add account</h2>
      <div className="row">
        <div className="field">
          <label>Name</label>
          <input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Cash, Prepaid card…" />
        </div>
        <div className="field">
          <label>Type</label>
          <select value={aType} onChange={(e) => setAType(e.target.value as AccountType)}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Currency</label>
          <select value={aCur} onChange={(e) => setACur(e.target.value)} style={{ width: 90 }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </select>
        </div>
        <button className="btn" onClick={saveAccount}>Add</button>
      </div>
    </div>

    <div className="panel">
      <h2>Transfer between accounts</h2>
      <div className="row">
        <div className="field">
          <label>Amount</label>
          <input type="number" step="0.01" value={tAmount} onChange={(e) => setTAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>From</label>
          <select value={tFrom} onChange={(e) => setTFrom(e.target.value)}>
            <option value="">— from —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>To</label>
          <select value={tTo} onChange={(e) => setTTo(e.target.value)}>
            <option value="">— to —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
        <div className="field">
          <label>Currency</label>
          <select value={tCur} onChange={(e) => setTCur(e.target.value)} style={{ width: 90 }}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>)}
          </select>
        </div>
        <button className="btn" onClick={saveTransfer}>Transfer</button>
      </div>

      <h2 style={{ marginTop: 22 }}>Recent transfers</h2>
      {transfers.length === 0 && <div className="empty">No transfers yet.</div>}
      {transfers.length > 0 && (
        <table>
          <thead><tr>
            <th className="date-cell">Date</th><th>From</th><th>To</th><th>Amount</th><th>Note</th><th></th>
          </tr></thead>
          <tbody>
            {transfers.map((t: Transfer) => (
              <tr key={t.id}>
                <td className="date-cell">{t.date}</td>
                <td className="muted">{t.from_name || accName(t.from_account)}</td>
                <td className="muted">{t.to_name || accName(t.to_account)}</td>
                <td className="right">{fmtCur(t.amount, t.currency)}</td>
                <td className="muted">{t.note}</td>
                <td className="right actions">
                  <button className="btn danger small" title="Delete" aria-label={`Delete transfer of ${t.date}`}
                    onClick={() => deleteTransfer(t.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    <div className="panel">
      <h2>Savings goals</h2>
      {goals.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {goals.map((g) => {
            const cur = Math.max(0, g.current || 0);
            const pct = g.target_amount > 0 ? Math.min(100, (cur / g.target_amount) * 100) : 0;
            const done = cur >= g.target_amount;
            return (
              <div key={g.id} className="budget-row">
                <div className="top">
                  <span>
                    {done ? "🎉 " : ""}{g.name}
                    <span className="muted"> — {g.account_name}{g.target_date ? ` · by ${g.target_date}` : ""}</span>
                  </span>
                  <span className={done ? "amount-income" : "muted"}>
                    {fmtCur(cur, g.currency || "ILS")} / {fmtCur(g.target_amount, g.currency || "ILS")} ({Math.round(pct)}%)
                    {" "}<button className="linkbtn" title="Delete goal" aria-label={`Delete goal ${g.name}`}
                      onClick={() => deleteGoal(g.id)}>✕</button>
                  </span>
                </div>
                <div className="bar">
                  <span style={{ width: `${pct}%`, background: done ? "var(--green)" : "var(--accent)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="row">
        <div className="field">
          <label>Goal name</label>
          <input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Emergency fund…" />
        </div>
        <div className="field">
          <label>Target (account currency)</label>
          <input type="number" step="0.01" value={gTarget} onChange={(e) => setGTarget(e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>Account</label>
          <select value={gAccount} onChange={(e) => setGAccount(e.target.value)}>
            <option value="">— account —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
          </select>
        </div>
        <div className="field">
          <label>Target date</label>
          <input type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} />
        </div>
        <button className="btn" onClick={saveGoal}>Add goal</button>
      </div>
    </div>
    </>
  );
}
