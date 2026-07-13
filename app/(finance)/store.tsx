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

  const sym = settings.currency_symbol || "₪";

  const notify = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2200);
  }, []);

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
    budgets, summary, sym, expenseCats, incomeCats, reload, reloadCategories, notify, toast,
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
    </Ctx.Provider>
  );
}

export default function FinanceProvider({ children }: { children: ReactNode }) {
  return <Chrome>{children}</Chrome>;
}
