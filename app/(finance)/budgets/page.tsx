"use client";

import { useState } from "react";
import { useFinance } from "../store";
import { API, sendJSON, fmt } from "@/lib/client";
import type { Category, Budget } from "@/lib/types";
import { useSort, useSorted, SortHeader } from "@/lib/sort";

export default function BudgetsPage() {
  const {
    month, sym, categories, budgets, expenseCats, reload, notify, confirm, undo,
  } = useFinance();

  const [bCat, setBCat] = useState<string>(""); // "" = overall
  const [bAmount, setBAmount] = useState("");
  const [bRollover, setBRollover] = useState(false);
  const [cName, setCName] = useState("");
  const [cDir, setCDir] = useState<"expense" | "income">("expense");
  const [bEditing, setBEditing] = useState(false);
  const [cEditId, setCEditId] = useState<number | null>(null);

  const startEditBudget = (b: Budget) => {
    setBEditing(true);
    setBCat(b.category_id != null ? String(b.category_id) : "");
    setBAmount(String(b.amount));
    setBRollover(!!b.rollover);
  };

  const cancelEditBudget = () => {
    setBEditing(false);
    setBAmount("");
    setBRollover(false);
  };

  const setBudget = async () => {
    const wasEditing = bEditing;
    const amount = parseFloat(bAmount);
    if (!Number.isFinite(amount) || amount < 0) return notify("Enter a valid budget");
    await sendJSON(`${API}/budgets`, "PUT", {
      month, category_id: bCat ? Number(bCat) : null, amount, rollover: bRollover,
    });
    setBAmount("");
    setBEditing(false);
    setBRollover(false);
    notify(wasEditing ? "Budget updated" : "Budget saved");
    reload();
  };

  const deleteBudget = async (id: number) => {
    const ok = await confirm({
      title: "Delete budget?",
      message: "This permanently removes the budget. You can undo it from the bottom bar right after.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    const r = await sendJSON<{ ok: boolean; log_id: number | null }>(`${API}/budgets/${id}`, "DELETE");
    notify("Budget removed");
    reload();
    if (r.log_id != null) undo({ message: "Budget deleted.", logId: r.log_id });
  };

  const startEditCat = (c: Category) => {
    setCEditId(c.id);
    setCName(c.name);
    setCDir(c.direction);
  };

  const cancelEditCat = () => {
    setCEditId(null);
    setCName("");
    setCDir("expense");
  };

  const saveCategory = async () => {
    if (!cName.trim()) return notify("Enter category name");
    if (cEditId != null) {
      const c = categories.find((x) => x.id === cEditId);
      await sendJSON(`${API}/categories/${cEditId}`, "PUT", {
        name: cName.trim(), direction: cDir, color: c?.color || "#7c9cff",
      });
      notify("Category updated");
    } else {
      await sendJSON(`${API}/categories`, "POST", { name: cName.trim(), direction: cDir });
      notify("Category added");
    }
    cancelEditCat();
    reload();
  };

  const visibleBudgets = budgets.filter((b) => b.amount > 0);
  const sort = useSort<"scope" | "budget">(null);
  const sortedBudgets = useSorted(visibleBudgets, sort, {
    scope: (b) => (b.category_id == null ? "Overall" : (b.category_name || "")),
    budget: (b) => b.amount,
  });

  return (
    <>
    <div className={bEditing ? "panel editing" : "panel"}>
      <h2>{bEditing ? "Edit budget" : "Set budget"}</h2>
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
        <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6, paddingBottom: 10 }}
          title="Unused budget carries over into next month">
          <input type="checkbox" checked={bRollover} onChange={(e) => setBRollover(e.target.checked)} />
          Roll over unused
        </label>
        {bEditing && <button className="btn secondary" onClick={cancelEditBudget}>Cancel</button>}
        <button className="btn" onClick={setBudget}>{bEditing ? "Update" : `Save for ${month}`}</button>
      </div>

      <h2 style={{ marginTop: 22 }}>Current budgets</h2>
      {visibleBudgets.length === 0 && (
        <div className="empty">No budgets for {month} yet — set an overall or per-category budget above.</div>
      )}
      {visibleBudgets.length > 0 && (
        <table>
          <thead><tr>
            <SortHeader sort={sort} k="scope">Scope</SortHeader>
            <SortHeader sort={sort} k="budget" className="right">Budget</SortHeader>
            <th></th>
          </tr></thead>
          <tbody>
            {sortedBudgets.map((b) => (
              <tr key={b.id}>
                <td>
                  {b.category_id == null ? "Overall" : (b.category_name || "—")}
                  {!!b.rollover && <span className="muted" style={{ fontSize: 12 }}> ↻ rollover</span>}
                </td>
                <td className="right">{fmt(b.amount, sym)}</td>
                <td className="right actions">
                  <button className="btn secondary small" title="Edit"
                    aria-label={`Edit ${b.category_id == null ? "overall" : b.category_name} budget`}
                    onClick={() => startEditBudget(b)}>✎</button>{" "}
                  <button className="btn danger small" title="Delete"
                    aria-label={`Delete ${b.category_id == null ? "overall" : b.category_name} budget`}
                    onClick={() => deleteBudget(b.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    <div className="panel">
      <h2>{cEditId != null ? "Edit category" : "Manage categories"}</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="cat-name">Name</label>
          <input id="cat-name" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="New category name" />
        </div>
        <div className="field">
          <label htmlFor="cat-dir">Type</label>
          <select id="cat-dir" value={cDir} onChange={(e) => setCDir(e.target.value as any)}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        {cEditId != null && <button className="btn secondary" onClick={cancelEditCat}>Cancel</button>}
        <button className="btn secondary" onClick={saveCategory}>{cEditId != null ? "Update" : "Add category"}</button>
      </div>
      <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
        {categories.map((c) => (
          <span key={c.id} className="tag" style={{ background: c.color }}>
            {c.name} <span className="muted">({c.direction})</span>{" "}
            <button className="linkbtn" title="Edit" aria-label={`Edit category ${c.name}`}
              onClick={() => startEditCat(c)}>✎</button>
          </span>
        ))}
      </div>
    </div>
    </>
  );
}
