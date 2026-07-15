"use client";

import { useState } from "react";
import { useFinance } from "../store";
import { API, sendJSON, fmtCur, catName, catColor, CURRENCIES } from "@/lib/client";
import type { Transaction } from "@/lib/types";
import { useSort, useSorted, SortHeader } from "@/lib/sort";

export default function TransactionsPage() {
  const {
    month, settings, categories, accounts, transactions, expenseCats, incomeCats, reload, notify, confirm, undo,
  } = useFinance();

  const [tAmount, setTAmount] = useState("");
  const [tDir, setTDir] = useState<"expense" | "income">("expense");
  const [tCat, setTCat] = useState<string>("");
  const [tCur, setTCur] = useState<string>(settings.currency || "ILS");
  const [tDate, setTDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [tNote, setTNote] = useState("");
  const [tAccount, setTAccount] = useState<string>("");
  const [editId, setEditId] = useState<number | null>(null);

  const sort = useSort<"date" | "category" | "note" | "amount">("date", "desc");
  const sortedTx = useSorted(transactions, sort, {
    date: (t) => t.date,
    category: (t) => catName(categories, t.category_id, t.direction) || "",
    note: (t) => t.note || "",
    amount: (t) => (t.direction === "expense" ? -t.amount : t.amount),
  });

  const startEditTx = (t: Transaction) => {
    setEditId(t.id);
    setTDir(t.direction);
    setTAmount(String(t.amount));
    setTCat(t.category_id != null ? String(t.category_id) : "");
    setTDate(t.date);
    setTNote(t.note || "");
    setTCur(t.currency || settings.currency || "ILS");
    setTAccount(t.account_id != null ? String(t.account_id) : "");
  };

  const cancelEdit = () => {
    setEditId(null);
    setTAmount(""); setTNote(""); setTCat("");
    setTDir("expense");
    setTDate(new Date().toISOString().slice(0, 10));
    setTCur(settings.currency || "ILS");
    setTAccount("");
  };

  const saveTransaction = async () => {
    const amount = parseFloat(tAmount);
    if (!Number.isFinite(amount) || amount <= 0) return notify("Enter a valid amount");
    const cid = tCat ? Number(tCat) : null;
    const payload = {
      amount, direction: tDir, category_id: cid, date: tDate, note: tNote, currency: tCur,
      account_id: tAccount ? Number(tAccount) : null,
    };
    if (editId != null) {
      await sendJSON(`${API}/transactions/${editId}`, "PUT", payload);
      notify("Updated");
    } else {
      await sendJSON(`${API}/transactions`, "POST", payload);
      notify("Saved");
    }
    cancelEdit();
    reload();
  };

  const deleteTransaction = async (id: number) => {
    const ok = await confirm({
      title: "Delete transaction?",
      message: "This permanently removes the transaction. You can undo it from the bottom bar right after.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const r = await sendJSON<{ ok: boolean; log_id: number | null }>(`${API}/transactions/${id}`, "DELETE");
    notify("Deleted");
    reload();
    if (r.log_id != null) undo({ message: "Transaction deleted.", logId: r.log_id });
  };

  return (
    <div className="panel">
      <h2>{editId != null ? "Edit transaction" : `Add ${tDir}`}</h2>
      <div className="row">
        <div className="field">
          <label>Type</label>
          <select value={tDir} onChange={(e) => { setTDir(e.target.value as any); setTCat(""); }}>
            <option value="expense">Expense</option>
            <option value="income">Income / Allowance</option>
          </select>
        </div>
        <div className="field">
          <label>Amount</label>
          <input type="number" step="0.01" value={tAmount} onChange={(e) => setTAmount(e.target.value)} placeholder="0.00" />
        </div>
        <div className="field">
          <label>Currency</label>
          <select value={tCur} onChange={(e) => setTCur(e.target.value)} style={{ width: 90 }}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
            ))}
          </select>
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
          <label>Account</label>
          <select value={tAccount} onChange={(e) => setTAccount(e.target.value)}>
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
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
        {editId != null && <button className="btn secondary" onClick={cancelEdit}>Cancel</button>}
        <button className="btn" onClick={saveTransaction}>{editId != null ? "Update" : "Add"}</button>
      </div>

      <h2 style={{ marginTop: 22 }}>This month</h2>
      {transactions.length === 0 && <div className="empty">Nothing logged yet.</div>}
      {transactions.length > 0 && (
        <table>
          <thead><tr>
            <SortHeader sort={sort} k="date">Date</SortHeader>
            <SortHeader sort={sort} k="category">Category</SortHeader>
            <SortHeader sort={sort} k="note">Note</SortHeader>
            <th>Account</th>
            <SortHeader sort={sort} k="amount" className="right">Amount</SortHeader>
            <th></th>
          </tr></thead>
          <tbody>
            {sortedTx.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  <span className="tag" style={{ background: catColor(categories, t.category_id) }}>
                    {catName(categories, t.category_id, t.direction)}
                  </span>
                </td>
                <td className="muted">{t.note}</td>
                <td className="muted">{t.account_name || "—"}</td>
                <td className={`right ${t.direction === "expense" ? "amount-expense" : "amount-income"}`}>
                  {t.direction === "expense" ? "-" : "+"}{fmtCur(t.amount, t.currency || settings.currency)}
                </td>
                <td className="right">
                  <button className="btn secondary small" title="Edit" onClick={() => startEditTx(t)}>✎</button>{" "}
                  <button className="btn danger small" title="Delete" onClick={() => deleteTransaction(t.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
