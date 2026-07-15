"use client";

import {
  createContext, useContext, useCallback, useEffect, useMemo, useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  API, getJSON, sendJSON, monthList, CURRENCIES, currentMonth,
} from "@/lib/client";
import type {
  Category, Transaction, Subscription, Budget, Summary, Settings,
} from "@/lib/types";

interface ConfirmOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}
interface ConfirmState extends ConfirmOpts {
  open: boolean;
  resolve?: (ok: boolean) => void;
}

interface UndoState {
  message: string;
  logId: number | null;
}

interface FinanceCtx {
  month: string;
  setMonth: (m: string) => void;
  categories: Category[];
  settings: Settings;
  transactions: Transaction[];
  subscriptions: Subscription[];
  budgets: Budget[];
  summary: Summary | null;
  sym: string;
  expenseCats: Category[];
  incomeCats: Category[];
  reload: () => void;
  reloadCategories: () => void;
  notify: (m: string) => void;
  toast: string | null;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  undo: (state: UndoState) => void;
}

const Ctx = createContext<FinanceCtx | null>(null);
export function useFinance(): FinanceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinance must be used within FinanceLayout");
  return v;
}

const TABS = [
  { key: "", label: "Dashboard", href: "/" },
  { key: "transactions", label: "Transactions", href: "/transactions" },
  { key: "subscriptions", label: "Subscriptions", href: "/subscriptions" },
  { key: "budgets", label: "Budgets", href: "/budgets" },
];

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const month = searchParams.get("month") || currentMonth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "ILS", currency_symbol: "₪" });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Confirmation modal state
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, title: "", message: "" });
  // Undo snackbar state
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const sym = settings.currency_symbol || "₪";

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  }, []);

  // Awaitable confirmation dialog. Resolves true when the user confirms.
  const confirm = useCallback((opts: ConfirmOpts): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({ ...opts, open: true, resolve });
    });
  }, []);

  const closeConfirm = useCallback((ok: boolean) => {
    setConfirmState((s) => {
      s.resolve?.(ok);
      return { open: false, title: "", message: "" };
    });
  }, []);

  // Show the bottom "undo" snackbar after a reversible delete.
  const undo = useCallback((state: UndoState) => {
    if (undoTimer) clearTimeout(undoTimer);
    setUndoState(state);
    const t = setTimeout(() => setUndoState(null), 8000);
    setUndoTimer(t);
  }, [undoTimer]);

  const doUndo = useCallback(async () => {
    if (!undoState?.logId) return;
    try {
      await sendJSON(`${API}/activity/${undoState.logId}/undo`, "POST");
      notify("Restored");
      setUndoState(null);
      if (undoTimer) clearTimeout(undoTimer);
      setReloadKey((k) => k + 1);
    } catch (e) {
      notify("Undo failed: " + String(e));
      setUndoState(null);
    }
  }, [undoState, undoTimer, notify]);

  const reloadCategories = useCallback(async () => {
    try {
      const [cats, s] = await Promise.all([
        getJSON<Category[]>(`${API}/categories`),
        getJSON<Settings>(`${API}/settings`),
      ]);
      setCategories(cats);
      setSettings(s);
    } catch (e) { notify("Load failed: " + String(e)); }
  }, [notify]);

  // categories + settings (once)
  useEffect(() => { reloadCategories(); }, [reloadCategories]);

  const loadMonth = useCallback(async () => {
    try {
      const [tx, subs, b, sum] = await Promise.all([
        getJSON<Transaction[]>(`${API}/transactions?month=${month}`),
        getJSON<Subscription[]>(`${API}/subscriptions`),
        getJSON<Budget[]>(`${API}/budgets?month=${month}`),
        getJSON<Summary>(`${API}/summary?month=${month}`),
      ]);
      setTransactions(tx);
      setSubscriptions(subs);
      setBudgets(b);
      setSummary(sum);
    } catch (e) { notify("Load failed: " + String(e)); }
  }, [month, notify]);

  useEffect(() => { loadMonth(); }, [loadMonth, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const setMonth = useCallback((m: string) => {
    const qs = m ? `?month=${m}` : "";
    router.replace(`${pathname}${qs}`);
  }, [pathname, router]);

  const setCurrency = useCallback(async (code: string) => {
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    await sendJSON(`${API}/settings`, "PUT", { currency: cur.code, currency_symbol: cur.symbol });
    setSettings((s) => ({ ...s, currency: cur.code, currency_symbol: cur.symbol }));
    notify(`Currency set to ${cur.code}`);
  }, [notify]);

  const expenseCats = useMemo(() => categories.filter((c) => c.direction === "expense"), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.direction === "income"), [categories]);

  const ctx: FinanceCtx = {
    month, setMonth, categories, settings, transactions, subscriptions,
    budgets, summary, sym, expenseCats, incomeCats, reload, reloadCategories, notify, toast, confirm, undo,
  };

  return (
    <Ctx.Provider value={ctx}>
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
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              {monthList().map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="nav">
          {TABS.map((t) => {
            const active = t.key === "" ? pathname === "/" : pathname === t.href;
            return (
              <Link key={t.key} href={`${t.href}?month=${month}`} className={active ? "active" : ""}>
                {t.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>

      {toast && <div className="toast">{toast}</div>}

      {confirmState.open && (
        <div className="modal-overlay" onClick={() => closeConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmState.title}</h3>
            <p>{confirmState.message}</p>
            <p className="muted" style={{ fontSize: 12 }}>This action cannot be undone after you close this dialog.</p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => closeConfirm(false)}>Cancel</button>
              <button
                className={confirmState.danger ? "btn danger" : "btn"}
                onClick={() => closeConfirm(true)}
              >{confirmState.confirmLabel || "Confirm"}</button>
            </div>
          </div>
        </div>
      )}

      {undoState && (
        <div className="undo-snackbar">
          <span>{undoState.message}</span>
          <button className="btn secondary small" onClick={doUndo}>Undo</button>
          <button className="undo-dismiss" onClick={() => setUndoState(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export default function FinanceProvider({ children }: { children: ReactNode }) {
  return <Chrome>{children}</Chrome>;
}
