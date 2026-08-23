"use client";

import {
  createContext, useContext, useCallback, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  API, getJSON, sendJSON, monthList, CURRENCIES, currentMonth,
} from "@/lib/client";
import { withQueryParam } from "@/lib/query";
import { readBetaDesign, writeBetaDesign } from "@/lib/design-preference";
import type {
  Category, Transaction, Subscription, Budget, Summary, Settings, Account, Transfer,
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
  accounts: Account[];
  transfers: Transfer[];
  reloadKey: number;
  reload: () => void;
  reloadCategories: () => void;
  notify: (m: string) => void;
  toast: string | null;
  confirm: (opts: ConfirmOpts) => Promise<boolean>;
  undo: (state: UndoState) => void;
  betaDesign: boolean;
}

const Ctx = createContext<FinanceCtx | null>(null);
export function useFinance(): FinanceCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinance must be used within FinanceLayout");
  

  return v;
}

// "2026-07" → "Jul 2026" for the month picker.
function monthLabel(m: string): string {
  

  return new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

const TABS = [
  { key: "", label: "Dashboard", v2Title: "💰 Financial Dashboard", href: "/" },
  { key: "transactions", label: "Transactions", v2Title: "📊 Transactions Ledger", href: "/transactions" },
  { key: "subscriptions", label: "Subscriptions", v2Title: "📅 Recurring & Subscriptions", href: "/subscriptions" },
  { key: "accounts", label: "Accounts", v2Title: "🏦 Accounts & Savings", href: "/accounts" },
  { key: "budgets", label: "Budgets", v2Title: "🎯 Budgets & Categories", href: "/budgets" },
  { key: "activity", label: "Activity", v2Title: "📋 System Activity & Audit Trail", href: "/activity" },
];

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMonth = searchParams.get("month") || currentMonth();
  const [month, setSelectedMonth] = useState(urlMonth);

  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings>({ currency: "ILS", currency_symbol: "₪" });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [betaDesign, setBetaDesign] = useState(false);

  // Confirmation dialog state (rendered as a native <dialog>)
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, title: "", message: "" });
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  // Keep the native dialog in sync with confirm state; showModal() gives us
  // the focus trap, Escape handling, and backdrop for free.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) 

    return;
    if (confirmState.open && !d.open) d.showModal();
    else if (!confirmState.open && d.open) d.close();
  }, [confirmState.open]);

  // Show the bottom "undo" snackbar after a reversible delete.
  const undo = useCallback((state: UndoState) => {
    if (undoTimer) clearTimeout(undoTimer);
    setUndoState(state);
    const t = setTimeout(() => setUndoState(null), 8000);
    setUndoTimer(t);
  }, [undoTimer]);

  const doUndo = useCallback(async () => {
    if (!undoState?.logId) 

    return;
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
  useEffect(() => { setSelectedMonth(urlMonth); }, [urlMonth]);
  useEffect(() => { setBetaDesign(readBetaDesign(window.localStorage)); }, []);

  const toggleBetaDesign = () => {
    setBetaDesign((enabled) => {
      writeBetaDesign(window.localStorage, !enabled);

      return !enabled;
    });
  };

  const loadMonth = useCallback(async () => {
    try {
      const [tx, subs, b, sum, accs, xf] = await Promise.all([
        getJSON<Transaction[]>(`${API}/transactions?month=${month}`),
        getJSON<Subscription[]>(`${API}/subscriptions`),
        getJSON<Budget[]>(`${API}/budgets?month=${month}`),
        getJSON<Summary>(`${API}/summary?month=${month}`),
        getJSON<Account[]>(`${API}/accounts?month=${month}`),
        getJSON<Transfer[]>(`${API}/transfers?month=${month}&limit=50`),
      ]);
      setTransactions(tx);
      setSubscriptions(subs);
      setBudgets(b);
      setSummary(sum);
      setAccounts(accs);
      setTransfers(xf);
    } catch (e) { notify("Load failed: " + String(e)); }
  }, [month, notify]);

  useEffect(() => { loadMonth(); }, [loadMonth, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const setMonth = useCallback((m: string) => {
    setSelectedMonth(m);
    const qs = withQueryParam(searchParams.toString(), "month", m);
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
  }, [pathname, router, searchParams]);

  const setCurrency = useCallback(async (code: string) => {
    const cur = CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
    await sendJSON(`${API}/settings`, "PUT", { currency: cur.code, currency_symbol: cur.symbol });
    notify(`Currency set to ${cur.code}`);
    // Refetch amounts in the new base FIRST, then flip the symbol — so the
    // converted numbers and the (new) symbol land together and the user never
    // sees a new symbol paired with old-base numbers.
    await loadMonth();
    setSettings((s) => ({ ...s, currency: cur.code, currency_symbol: cur.symbol }));
  }, [notify, loadMonth]);

  const expenseCats = useMemo(() => categories.filter((c) => c.direction === "expense"), [categories]);
  const incomeCats = useMemo(() => categories.filter((c) => c.direction === "income"), [categories]);
  const activeTab = TABS.find((t) => (t.key === "" ? pathname === "/" : pathname === t.href)) || TABS[0];

  const ctx: FinanceCtx = {
    month, setMonth, categories, settings, transactions, subscriptions,
    budgets, summary, sym, expenseCats, incomeCats, accounts, transfers, reloadKey, reload, reloadCategories,
    notify, toast, confirm, undo, betaDesign,
  };

  const designToggleBtn = (
    <button
      type="button"
      className="design-toggle"
      role="switch"
      aria-checked={betaDesign}
      aria-label={`Design Language v2 beta is ${betaDesign ? "on" : "off"}. Switch to ${betaDesign ? "current design" : "beta design"}`}
      onClick={toggleBetaDesign}
    >
      <span className="design-toggle-copy">
        <strong>Design v2</strong>
        <small>{betaDesign ? "Beta on" : "Try beta"}</small>
      </span>
      <span className="switch-track" aria-hidden="true"><span /></span>
    </button>
  );

  return (
    <Ctx.Provider value={ctx}>
      {betaDesign ? (
        <div className="app" data-design="v2">
          <aside className="sidebar">
            <div>
              <div className="brand">
                <span className="brand-mark" aria-hidden="true">F</span>
                <span className="brand-name">Finance</span>
              </div>
              <nav className="nav" aria-label="Primary">
                {TABS.map((t) => {
                  const active = t.key === "" ? pathname === "/" : pathname === t.href;

                  return (
                    <Link key={t.key} href={`${t.href}?month=${month}`} className={active ? "active" : ""}
                      aria-current={active ? "page" : undefined}>
                      <span className="nav-dot" aria-hidden="true" />
                      {t.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="user-profile">
              <span className="avatar" aria-hidden="true">F</span>
              <span className="user-info">
                <strong>Personal Finance</strong>
                <small>Local &amp; private</small>
              </span>
            </div>
          </aside>

          <div className="content-area">
            <div className="topbar">
              <h1>{activeTab.v2Title}</h1>
              <div className="month-picker">
                <span className="selector">
                  <label htmlFor="pick-currency">Currency</label>
                  <select id="pick-currency" value={settings.currency} onChange={(e) => setCurrency(e.target.value)}>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                    ))}
                  </select>
                </span>
                <span className="selector">
                  <label htmlFor="pick-month">Month</label>
                  <select id="pick-month" value={month} onChange={(e) => setMonth(e.target.value)}>
                    {monthList().map((m) => (
                      <option key={m} value={m}>{monthLabel(m)}</option>
                    ))}
                  </select>
                </span>
                {designToggleBtn}
              </div>
            </div>

            <main className="finance-content">{children}</main>
          </div>
        </div>
      ) : (
        <div className="app" data-design="current">
          <div className="topbar">
            <h1>💰 Finance</h1>
            <div className="month-picker">
              <label className="muted" htmlFor="pick-currency">Currency</label>
              <select id="pick-currency" value={settings.currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>
                ))}
              </select>
              <label className="muted" htmlFor="pick-month">Month</label>
              <select id="pick-month" value={month} onChange={(e) => setMonth(e.target.value)}>
                {monthList().map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}</option>
                ))}
              </select>
              {designToggleBtn}
            </div>
          </div>

          <nav className="nav" aria-label="Primary">
            {TABS.map((t) => {
              const active = t.key === "" ? pathname === "/" : pathname === t.href;

              return (
                <Link key={t.key} href={`${t.href}?month=${month}`} className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}>
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <main className="finance-content">{children}</main>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}

      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby="confirm-title"
        onCancel={() => closeConfirm(false)}
        onClick={(e) => {
          // A click on the backdrop targets the dialog element itself but
          // lands outside its box — treat that as cancel.
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
            closeConfirm(false);
          }
        }}
      >
        <h3 id="confirm-title">{confirmState.title}</h3>
        <p>{confirmState.message}</p>
        <div className="modal-actions">
          <button className="btn secondary" onClick={() => closeConfirm(false)}>Cancel</button>
          <button
            className={confirmState.danger ? "btn danger" : "btn"}
            onClick={() => closeConfirm(true)}
          >{confirmState.confirmLabel || "Confirm"}</button>
        </div>
      </dialog>

      {undoState && (
        <div className="undo-snackbar" role="status">
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
