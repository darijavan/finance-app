"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFinance } from "../store";
import { API, getJSON, sendJSON, fmtCur, catName, catColor, CURRENCIES } from "@/lib/client";
import { parseCSV, toCSV, normalizeDate, normalizeAmount, type DateFormat } from "@/lib/csv";
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
  const [showImport, setShowImport] = useState(false);

  // Search / filters. When any filter is set, results come from the API across
  // all months instead of the month view.
  const [fQ, setFQ] = useState("");
  const [fAccount, setFAccount] = useState("");
  const [fCat, setFCat] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fMin, setFMin] = useState("");
  const [fMax, setFMax] = useState("");
  const [filtered, setFiltered] = useState<Transaction[] | null>(null);
  const filterActive = !!(fQ || fAccount || fCat || fFrom || fTo || fMin || fMax);

  useEffect(() => {
    if (!filterActive) { setFiltered(null); return; }
    const params = new URLSearchParams();
    if (fQ) params.set("q", fQ);
    if (fAccount) params.set("account_id", fAccount);
    if (fCat) params.set("category_id", fCat);
    if (fFrom) params.set("from", fFrom);
    if (fTo) params.set("to", fTo);
    if (fMin) params.set("min", fMin);
    if (fMax) params.set("max", fMax);
    const t = setTimeout(() => {
      getJSON<Transaction[]>(`${API}/transactions?${params}`)
        .then(setFiltered)
        .catch((e) => notify("Search failed: " + String(e)));
    }, 250); // debounce typing
    return () => clearTimeout(t);
  }, [filterActive, fQ, fAccount, fCat, fFrom, fTo, fMin, fMax, notify]);

  const clearFilters = () => {
    setFQ(""); setFAccount(""); setFCat(""); setFFrom(""); setFTo(""); setFMin(""); setFMax("");
  };

  const rows = filterActive ? (filtered ?? []) : transactions;

  const sort = useSort<"date" | "category" | "note" | "amount">("date", "desc");
  const sortedTx = useSorted(rows, sort, {
    date: (t) => t.date,
    category: (t) => catName(categories, t.category_id, t.direction) || "",
    note: (t) => t.note || "",
    amount: (t) => (t.direction === "expense" ? -t.amount : t.amount),
  });

  const exportCSV = () => {
    const data = toCSV([
      ["date", "direction", "amount", "currency", "category", "account", "note"],
      ...sortedTx.map((t) => [
        t.date, t.direction, t.amount, t.currency || settings.currency,
        catName(categories, t.category_id, t.direction) || "",
        t.account_name || "", t.note || "",
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${filterActive ? "filtered" : month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    if (filterActive) setFiltered((f) => f?.filter((t) => t.id !== id) ?? null);
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

      <h2 style={{ marginTop: 22 }}>Search &amp; filter</h2>
      <div className="row">
        <div className="field">
          <label>Text</label>
          <input value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="note contains…" />
        </div>
        <div className="field">
          <label>Account</label>
          <select value={fAccount} onChange={(e) => setFAccount(e.target.value)}>
            <option value="">— any —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)}>
            <option value="">— any —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>From</label>
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
        <div className="field">
          <label>Min</label>
          <input type="number" step="0.01" value={fMin} onChange={(e) => setFMin(e.target.value)} style={{ width: 90 }} />
        </div>
        <div className="field">
          <label>Max</label>
          <input type="number" step="0.01" value={fMax} onChange={(e) => setFMax(e.target.value)} style={{ width: 90 }} />
        </div>
        {filterActive && <button className="btn secondary" onClick={clearFilters}>Clear</button>}
      </div>

      <div className="row" style={{ marginTop: 22, justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>
          {filterActive ? `Search results (${rows.length}, all months)` : "This month"}
        </h2>
        <div>
          <button className="btn secondary small" onClick={exportCSV} disabled={sortedTx.length === 0}>⬇ Export CSV</button>{" "}
          <button className="btn secondary small" onClick={() => setShowImport((s) => !s)}>
            {showImport ? "Close import" : "⬆ Import CSV"}
          </button>
        </div>
      </div>

      {showImport && (
        <ImportCSV
          onDone={() => { setShowImport(false); reload(); }}
          notify={notify}
        />
      )}

      {rows.length === 0 && <div className="empty">{filterActive ? "No matches." : "Nothing logged yet."}</div>}
      {rows.length > 0 && (
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
                <td className="right actions">
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

// Bank-statement CSV import: parse locally, map columns, preview, then send
// valid rows to the server which skips duplicates.
type SignRule = "sign" | "sign-inverted" | "expense" | "income";

function ImportCSV({ onDone, notify }: { onDone: () => void; notify: (m: string) => void }) {
  const { settings, accounts, categories } = useFinance();
  const fileRef = useRef<HTMLInputElement>(null);
  const [grid, setGrid] = useState<string[][] | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [dateCol, setDateCol] = useState(0);
  const [amountCol, setAmountCol] = useState(1);
  const [noteCol, setNoteCol] = useState<number>(-1);
  const [dateFormat, setDateFormat] = useState<DateFormat>("auto");
  const [signRule, setSignRule] = useState<SignRule>("sign");
  const [iCur, setICur] = useState(settings.currency || "ILS");
  const [iAccount, setIAccount] = useState("");
  const [iCat, setICat] = useState("");
  const [busy, setBusy] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const g = parseCSV(await f.text());
    if (g.length === 0) return notify("Empty file");
    setGrid(g);
    // Guess columns from the header row.
    const header = g[0].map((h) => h.toLowerCase());
    const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
    const d = find("date", "תאריך");
    const a = find("amount", "sum", "value", "סכום");
    const n = find("note", "desc", "detail", "memo", "name", "merchant", "פירוט", "תיאור");
    setDateCol(d >= 0 ? d : 0);
    setAmountCol(a >= 0 ? a : Math.min(1, g[0].length - 1));
    setNoteCol(n);
    setHasHeader(d >= 0 || a >= 0 || g[0].every((c) => normalizeAmount(c) == null));
  };

  const dataRows = useMemo(() => (grid ? (hasHeader ? grid.slice(1) : grid) : []), [grid, hasHeader]);

  const parsed = useMemo(() => dataRows.map((r) => {
    const date = normalizeDate(r[dateCol] ?? "", dateFormat);
    const raw = normalizeAmount(r[amountCol] ?? "");
    if (date == null || raw == null || raw === 0) return null;
    let direction: "expense" | "income";
    if (signRule === "expense") direction = "expense";
    else if (signRule === "income") direction = "income";
    else {
      const negIsExpense = signRule === "sign";
      direction = (raw < 0) === negIsExpense ? "expense" : "income";
    }
    return { date, amount: Math.abs(raw), direction, note: noteCol >= 0 ? (r[noteCol] ?? "").trim() : "" };
  }), [dataRows, dateCol, amountCol, noteCol, dateFormat, signRule]);

  const valid = parsed.filter((p) => p != null) as NonNullable<typeof parsed[number]>[];
  const invalid = parsed.length - valid.length;

  const doImport = async () => {
    if (valid.length === 0) return notify("No importable rows");
    setBusy(true);
    try {
      const r = await sendJSON<{ created: number; skipped: number; invalid: number }>(
        `${API}/transactions/import`, "POST", {
          rows: valid, currency: iCur,
          account_id: iAccount ? Number(iAccount) : null,
          category_id: iCat ? Number(iCat) : null,
        });
      notify(`Imported ${r.created}, skipped ${r.skipped} duplicate(s)`);
      onDone();
    } catch (e) {
      notify("Import failed: " + String(e));
    } finally {
      setBusy(false);
    }
  };

  const colOptions = grid ? grid[0].map((_, i) => (
    <option key={i} value={i}>
      col {i + 1}{hasHeader ? ` (${grid[0][i].slice(0, 18)})` : ""}
    </option>
  )) : null;

  return (
    <div className="panel" style={{ background: "var(--panel-2)", marginTop: 12 }}>
      <h2>Import bank statement (CSV)</h2>
      <div className="row">
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        {grid && (
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
            First row is headers
          </label>
        )}
      </div>
      {grid && (
        <>
          <div className="row" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Date column</label>
              <select value={dateCol} onChange={(e) => setDateCol(Number(e.target.value))}>{colOptions}</select>
            </div>
            <div className="field">
              <label>Amount column</label>
              <select value={amountCol} onChange={(e) => setAmountCol(Number(e.target.value))}>{colOptions}</select>
            </div>
            <div className="field">
              <label>Note column</label>
              <select value={noteCol} onChange={(e) => setNoteCol(Number(e.target.value))}>
                <option value={-1}>— none —</option>
                {colOptions}
              </select>
            </div>
            <div className="field">
              <label>Date format</label>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                <option value="auto">Auto</option>
                <option value="dmy">DD/MM/YYYY</option>
                <option value="mdy">MM/DD/YYYY</option>
              </select>
            </div>
            <div className="field">
              <label>Direction</label>
              <select value={signRule} onChange={(e) => setSignRule(e.target.value as SignRule)}>
                <option value="sign">Negative = expense</option>
                <option value="sign-inverted">Negative = income</option>
                <option value="expense">All expenses</option>
                <option value="income">All income</option>
              </select>
            </div>
            <div className="field">
              <label>Currency</label>
              <select value={iCur} onChange={(e) => setICur(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Account</label>
              <select value={iAccount} onChange={(e) => setIAccount(e.target.value)}>
                <option value="">— none —</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <select value={iCat} onChange={(e) => setICat(e.target.value)}>
                <option value="">— none —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <h2 style={{ marginTop: 14 }}>Preview</h2>
          <p className="muted" style={{ fontSize: 12 }}>
            {valid.length} importable row(s){invalid > 0 ? `, ${invalid} skipped (bad date/amount)` : ""}.
            Duplicates already in the app are skipped automatically on import.
          </p>
          {valid.length > 0 && (
            <table>
              <thead><tr><th>Date</th><th>Direction</th><th className="right">Amount</th><th>Note</th></tr></thead>
              <tbody>
                {valid.slice(0, 8).map((p, i) => (
                  <tr key={i}>
                    <td>{p.date}</td>
                    <td className={p.direction === "expense" ? "amount-expense" : "amount-income"}>{p.direction}</td>
                    <td className="right">{fmtCur(p.amount, iCur)}</td>
                    <td className="muted">{p.note}</td>
                  </tr>
                ))}
                {valid.length > 8 && (
                  <tr><td colSpan={4} className="muted">…and {valid.length - 8} more</td></tr>
                )}
              </tbody>
            </table>
          )}
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={doImport} disabled={busy || valid.length === 0}>
              {busy ? "Importing…" : `Import ${valid.length} row(s)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
