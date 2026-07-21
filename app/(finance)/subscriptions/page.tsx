"use client";

import { useRef, useState } from "react";
import { useFinance } from "../store";
import { API, sendJSON, fmt, fmtCur, CURRENCIES } from "@/lib/client";
import type { Subscription } from "@/lib/types";
import { useSort, useSorted, SortHeader } from "@/lib/sort";

export default function SubscriptionsPage() {
  const {
    month, sym, settings, subscriptions, summary, expenseCats, incomeCats, accounts, reload, notify, confirm, undo,
  } = useFinance();

  const [sName, setSName] = useState("");
  const [sAmount, setSAmount] = useState("");
  const [sDir, setSDir] = useState<"expense" | "income">("expense");
  const [sFreq, setSFreq] = useState<"monthly" | "yearly">("monthly");
  const [sCat, setSCat] = useState<string>("");
  const [sCur, setSCur] = useState<string>(settings.currency || "ILS");
  const [sDay, setSDay] = useState("1");
  const [sMonth, setSMonth] = useState("1");
  const [sDate, setSDate] = useState<string>(""); // start date YYYY-MM-DD
  const [sAccount, setSAccount] = useState<string>("");
  const [sEditId, setSEditId] = useState<number | null>(null);

  const sort = useSort<"name" | "amount" | "freq" | "monthly" | "cat">(null);
  const sortedSubs = useSorted(subscriptions, sort, {
    name: (s) => s.name,
    amount: (s) => s.amount,
    freq: (s) => s.frequency,
    monthly: (s) => s.monthly_equivalent || 0,
    cat: (s) => s.category_name || "",
  });

  const formRef = useRef<HTMLDivElement>(null);

  const startEditSub = (s: Subscription) => {
    // The form lives above the list — bring it into view so the edit is obvious.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setSEditId(s.id);
    setSName(s.name);
    setSAmount(String(s.amount));
    setSDir(s.direction);
    setSFreq(s.frequency);
    setSCat(s.category_id != null ? String(s.category_id) : "");
    setSCur(s.currency || settings.currency || "ILS");
    setSDay(String(s.day_of_month));
    setSMonth(s.month_of_year != null ? String(s.month_of_year) : "1");
    setSDate(s.start_date || "");
    setSAccount(s.account_id != null ? String(s.account_id) : "");
  };

  const cancelEditSub = () => {
    setSEditId(null);
    setSName(""); setSAmount(""); setSCat("");
    setSDir("expense"); setSFreq("monthly"); setSDay("1"); setSMonth("1"); setSDate(""); setSAccount("");
  };

  const saveSubscription = async () => {
    const amount = parseFloat(sAmount);
    if (!sName.trim() || !Number.isFinite(amount) || amount <= 0) return notify("Enter name + amount");
    const payload: Record<string, unknown> = {
      name: sName.trim(), amount, direction: sDir, frequency: sFreq, currency: sCur,
      category_id: sCat ? Number(sCat) : null,
      day_of_month: Number(sDay), month_of_year: sFreq === "yearly" ? Number(sMonth) : null,
      start_date: sDate ? sDate : null,
      account_id: sAccount ? Number(sAccount) : null,
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
    <>
    <div className={sEditId != null ? "panel editing" : "panel"} ref={formRef}>
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
          <label>Paid from</label>
          <select value={sAccount} onChange={(e) => setSAccount(e.target.value)}>
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Day of month</label>
          <input type="number" min="1" max="28" value={sDay} onChange={(e) => setSDay(e.target.value)} style={{ width: 70 }} />
        </div>
        <div className="field">
          <label>Start date</label>
          <input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} />
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
    </div>

    <div className="panel">
      <h2>Subscriptions</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn secondary small" onClick={chargeSubscriptions}>
          ⚡ Charge now ({month})
        </button>
        <span className="muted">
          Due subscriptions are charged <strong>automatically every night</strong> — this button only
          backfills the selected month if needed. Nothing is ever charged twice or ahead of its due day.
        </span>
      </div>
      {subscriptions.length === 0 && (
        <div className="empty">No subscriptions yet — add recurring bills or income above and they are charged automatically when due.</div>
      )}
      {subscriptions.length > 0 && (
        <table>
          <thead><tr>
            <SortHeader sort={sort} k="name">Name</SortHeader>
            <SortHeader sort={sort} k="amount">Amount</SortHeader>
            <SortHeader sort={sort} k="freq">Freq</SortHeader>
            <SortHeader sort={sort} k="monthly">~/mo</SortHeader>
            <SortHeader sort={sort} k="cat">Cat</SortHeader>
            <th>Paid from</th>
            <th>Started</th>
            <th></th>
          </tr></thead>
          <tbody>
            {sortedSubs.map((s) => (
              <tr key={s.id} style={{ opacity: s.active ? 1 : 0.5 }}>
                <td>{s.name}</td>
                <td className={s.direction === "expense" ? "amount-expense" : "amount-income"}>
                  {s.direction === "expense" ? "-" : "+"}{fmtCur(s.amount, s.currency || settings.currency)}
                  {s.last_charge_amount != null && s.last_charge_amount !== s.amount && (
                    <span className="muted" title="Price changed since the last charge" style={{ marginLeft: 6, fontSize: 12 }}>
                      ⚠ was {fmtCur(s.last_charge_amount, s.currency || settings.currency)}
                    </span>
                  )}
                </td>
                <td className="muted">{s.frequency}{s.frequency === "yearly" ? ` (m${s.month_of_year})` : ""}</td>
                <td className="muted">{fmtCur(s.monthly_equivalent || 0, s.currency || settings.currency)}</td>
                <td><span className="tag" style={{ background: s.category_color || "#888" }}>{s.category_name || "—"}</span></td>
                <td className="muted">{s.account_name || "—"}</td>
                <td className="muted">{s.start_date || "—"}</td>
                <td className="right actions">
                  <button className="btn secondary small" title="Edit" aria-label={`Edit subscription ${s.name}`}
                    onClick={() => startEditSub(s)}>✎</button>{" "}
                  <button className="btn danger small" title="Delete" aria-label={`Delete subscription ${s.name}`}
                    onClick={() => deleteSubscription(s.id)}>✕</button>
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
    </>
  );
}
