import type { Category, Settings } from "./types";

export const API = "/api";

export async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
export async function sendJSON<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function fmt(n: number, sym: string) {
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function symbolOf(code: string): string {
  const c = CURRENCIES.find((x) => x.code === code);
  return c ? c.symbol : code + " ";
}

// Format an amount using the symbol for its own currency code.
export function fmtCur(n: number, code: string) {
  return fmt(n, symbolOf(code));
}

const MONTHS_BACK = 12;
export function monthList(): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < MONTHS_BACK; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export const CURRENCIES = [
  { code: "ILS", symbol: "₪" }, { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" }, { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" }, { code: "MGA", symbol: "Ar" },
];

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function catName(categories: Category[], id: number | null, direction: string) {
  if (id == null) return null;
  const c = categories.find((x) => x.id === id);
  return c ? c.name : (direction === "income" ? "Income" : "Other");
}
export function catColor(categories: Category[], id: number | null) {
  const c = categories.find((x) => x.id === id);
  return c ? c.color : "#888";
}

export type { Settings };
