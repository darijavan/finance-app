import { DEFAULT_CURRENCY, isCurrency } from "./currency.ts";
import type { Currency } from "./currency.ts";

// Shared request-body validation used by both POST and PUT API routes.
// Parsers return null on invalid input; routes turn null into a 400.

export function money(v: unknown): number | null {
  const n = Math.abs(Number(v));
  

  return Number.isFinite(n) && n > 0 ? n : null;
}

// Budgets allow 0 (used to clear a budget).
export function moneyOrZero(v: unknown): number | null {
  const n = Math.abs(Number(v));
  

  return Number.isFinite(n) ? n : null;
}

// Normalize a currency code; empty/missing falls back, garbage is rejected.
export function currency(v: unknown, fallback: Currency = DEFAULT_CURRENCY): Currency | null {
  if (v == null || v === "") 

  return fallback;
  const code = String(v).trim().toUpperCase();
  

  return isCurrency(code) ? code : null;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  

  return (allowed as readonly string[]).includes(v as string) ? (v as T) : fallback;
}

export function isoDate(v: unknown): string | null {
  

  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function isoMonth(v: unknown): string | null {
  

  return typeof v === "string" && /^\d{4}-\d{2}$/.test(v) ? v : null;
}

// Optional foreign key: null/""/undefined -> null, otherwise a positive integer.
export function optionalId(v: unknown): number | null | undefined {
  if (v == null || v === "") 

  return null;
  const n = Number(v);
  

  return Number.isInteger(n) && n > 0 ? n : undefined; // undefined = invalid
}

export function intInRange(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  

  return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
}

// Only these settings keys may be written through the API.
export const SETTINGS_KEYS = ["currency", "currency_symbol"] as const;
