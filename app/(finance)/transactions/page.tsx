"use client";

import { useState } from "react";
import { useFinance } from "../store";
import { API, sendJSON, fmt, catName, catColor } from "@/lib/client";

export default function TransactionsPage() {
  const {
    month, sym, categories, transactions, expenseCats, incomeCats, reload, notify,
  } = useFinance();

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
    reload();
  };

  const deleteTransaction = async (id: number) => {
    await sendJSON(`${API}/transactions/${id}`, "DELETE");
    notify("Deleted");
    reload();
  };

  return (
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
                  <span className="tag" style={{ background: catColor(categories, t.category_id) }}>
                    {catName(categories, t.category_id, t.direction)}
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
  );
}
