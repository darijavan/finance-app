"use client";

import { useState } from "react";
import { useFinance } from "../store";
import { API, sendJSON, fmt, fmtCur, CURRENCIES } from "@/lib/client";
import type { Subscription } from "@/lib/types";
import { useSort, useSorted, SortHeader } from "@/lib/sort";

export default function SubscriptionsPage() {
  const {
    month, sym, settings, subscriptions, summary, expenseCats, incomeCats, reload, notify, confirm, undo,
  } = useFinance();

  const [sName, setSName] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sDir, setSDir] = useState<"expense" | "income">("expense");
  const [sFreq, setSFreq] = useState<"monthly" | "yearly">("monthly");
  const [sCat, setSCat] = useState<string>("");
  const [sCur, setSCur] = useState<string>(settings.currency || "ILS");
  const [sDay, setSDay] = useState("1");
  const [sMonth, setSMonth] = useState("1");
  const [sEditId, setSEditId] = useState<number | null>(null);

  const sort = useSort<"name" | "amount" | "freq" | "monthly" | "cat">(null);
  const sortedSubs = useSorted(subscriptions, sort, {
    name: (s) => s.name,
    amount: (s) => s.amount,
    freq: (s) => s.frequency,
    monthly: (s) => s.monthly_equivalent || 0,
    cat: (s) => s.category_name || "",
  });

  const startEditSub = (s: Subscription) => {
    setSEditId(s.id);
    setSName(s.name);
    setSAmount(String(s.amount));
    setSDir(s.direction);
    setSFreq(s.frequency);
    setSCat(s.category_id != null ? String(s.category_id) : "");
    setSCur(s.currency || settings.currency || "ILS");
    setSDay(String(s.day_of_month));
    setSMonth(s.month_of_year != null ? String(s.month_of_year) : "1");
  };

  const cancelEditSub = () => {
    setSEditId(null);
    setSName(""); setSAmount(""); setSCat("");
    setSDir("expense"); setSFreq("monthly"); setSDay("1"); setSMonth("1");
  };

  const saveSubscription = async () => {
    const amount = parseFloat(sAmount);
    if (!sName.trim() || !Number.isFinite(amount) || amount <= 0) return notify("Enter name + amount");
    const payload: Record<string, unknown> = {
      name: sName.trim(), amount, direction: sDir, frequency: sFreq, currency: sCur,
      category_id: sCat ? Number(sCat) : null,
      day_of_month: Number(sDay), month_of_year: sFreq === "yearly" ? Number(sMonth) : null,
    };
    if (sEditId != null) payload.subscription_id = sEditId;
    if (sEditId != null) {
      await sendJSON(`${API}/subscriptions/${sEditId}`, "PUT", payload);
      notify("Updated");
    } else {
      await sendJSON(`${API}/subscriptions`, "POST", payload);
      notify("Subscription added");
    }
    cancelEditSub();
    reload();
  };

  const deleteSubscription = async (id: number) => {
    const ok = await confirm({
      title: "Delete subscription?",
      message: "This permanently removes the subscription. You can undo it from the bottom bar right after.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const r = await sendJSON<{ ok: boolean; log_id: number | null }>(`${API}/subscriptions/${id}`, "DELETE");
    notify("Removed");
    reload();
    if (r.log_id != null) undo({ message: "Subscription deleted.", logId: r.log_id });
  };

  const chargeSubscriptions = async () => {
    const r = await sendJSON<{ created: number }>(`${API}/subscriptions/charge?month=${month}`, "POST");
    notify(`Charged ${r.created} subscription(s)`);
    reload();
  };

  return (
    <div className="panel">
      <h2>{sEditId != null ? "Edit subscription" : "Add subscription"}</h2>
      <div className="row">
        <div className="field">
          <label>Name</label>
          <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Netflix, Rent, Allowance…" />
        </div>
        <div className="field">
          <label>Amount</label>
          <input type="number" step="0.01" value={sAmount} onChange={(e) => setSAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>Currency</label>
          <select value={sCur} onChange={(e) => setSCur(e.target.value)} style={{ width: 90 }}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
            ))}
          </select>
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
        {sEditId != null && <button className="btn secondary" onClick={cancelEditSub}>Cancel</button>}
        <button className="btn" onClick={saveSubscription}>{sEditId != null ? "Update" : "Add"}</button>
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
          <thead><tr>
            <SortHeader sort={sort} k="name">Name</SortHeader>
            <SortHeader sort={sort} k="amount">Amount</SortHeader>
            <SortHeader sort={sort} k="freq">Freq</SortHeader>
            <SortHeader sort={sort} k="monthly">~/mo</SortHeader>
            <SortHeader sort={sort} k="cat">Cat</SortHeader>
            <th></th>
          </tr></thead>
          <tbody>
            {sortedSubs.map((s) => (
              <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                <td>{s.name}</td>
                <td className={s.direction === "expense" ? "amount-expense" : "amount-income"}>
                  {s.direction === "expense" ? "-" : "+"}{fmtCur(s.amount, s.currency || settings.currency)}
                </td>
                <td className="muted">{s.frequency}{s.frequency === "yearly" ? ` (m${s.month_of_year})` : ""}</td>
                <td className="muted">{fmtCur(s.monthly_equivalent || 0, s.currency || settings.currency)}</td>
                <td><span className="tag" style={{ background: s.category_color || "#888" }}>{s.category_name || "—"}</span></td>
                <td className="right">
                  <button className="btn secondary small" title="Edit" onClick={() => startEditSub(s)}>✎</button>{" "}
                  <button className="btn danger small" title="Delete" onClick={() => deleteSubscription(s.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
        Total recurring ≈ {fmt(summary?.recurring_monthly ?? 0, sym)} / month
        <span style={{ marginLeft: 6 }}>(converted to {settings.currency})</span>
      </p>
    </div>
  );
}
