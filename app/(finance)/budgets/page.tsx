"use client";

import { useState } from "react";
import { useFinance } from "../store";
import { API, sendJSON, fmt } from "@/lib/client";

export default function BudgetsPage() {
  const {
    month, sym, categories, budgets, expenseCats, reload, notify,
  } = useFinance();

  const [bCat, setBCat] = useState<string>(""); // "" = overall
  const [bAmount, setBAmount] = useState("");
  const [cName, setCName] = useState("");
  const [cDir, setCDir] = useState<"expense" | "income">("expense");

  const setBudget = async () => {
    const amount = parseFloat(bAmount);
    if (!Number.isFinite(amount) || amount < 0) return notify("Enter a valid budget");
    await sendJSON(`${API}/budgets`, "PUT", {
      month, category_id: bCat ? Number(bCat) : null, amount,
    });
    setBAmount("");
    notify("Budget saved");
    reload();
  };

  const deleteBudget = async (id: number) => {
    await sendJSON(`${API}/budgets/${id}`, "DELETE");
    notify("Budget removed");
    reload();
  };

  const addCategory = async () => {
    if (!cName.trim()) return notify("Enter category name");
    await sendJSON(`${API}/categories`, "POST", { name: cName.trim(), direction: cDir });
    setCName("");
    notify("Category added");
    reload();
  };

  const visibleBudgets = budgets.filter((b) => b.amount > 0);

  return (
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
      {visibleBudgets.length === 0 && <div className="empty">No budgets for {month}.</div>}
      {visibleBudgets.length > 0 && (
        <table>
          <thead><tr><th>Scope</th><th className="right">Budget</th><th></th></tr></thead>
          <tbody>
            {visibleBudgets.map((b) => (
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
  );
}
