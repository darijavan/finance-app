import type { Currency } from "./currency.ts";
import { getDb } from "./db.ts";

const DAILY_FX_ENDPOINT = "https://api.frankfurter.dev/v1";
const FALLBACK_DAILY_FX_ENDPOINT = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api";

export type FxSnapshot = {
  amount: number;
  rate: number;
  rate_date: string;
  source: string;
};

/** Convert with an explicit, immutable rate and round to the target currency's cents. */
export function convertAmount(amount: number, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("FX rate must be positive");
  
  return Math.round(amount * rate * 100) / 100;
}

/**
 * Return the historical rate for a calendar day and persist the provider quote.
 * Frankfurter returns the preceding business day for weekends/holidays; rate_date
 * records that actual quotation date so the audit trail remains explicit.
 */
export async function snapshotConversion(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  date: string,
): Promise<FxSnapshot> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  if (from === to) 

  return { amount: convertAmount(amount, 1), rate: 1, rate_date: date, source: "identity" };

  const db = getDb();
  const cached = db.prepare(
    `SELECT rate, rate_date, source FROM fx_daily_rates
     WHERE requested_date=? AND base_currency=? AND quote_currency=?`,
  ).get(date, from, to) as { rate: number; rate_date: string; source: string } | undefined;
  if (cached) {
    
    return { amount: convertAmount(amount, cached.rate), rate: cached.rate, rate_date: cached.rate_date, source: cached.source };
  }

  const response = await fetch(
    `${DAILY_FX_ENDPOINT}/${encodeURIComponent(date)}?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
    { cache: "no-store" },
  );
  const data = response.ok
    ? await response.json() as { date?: string; rates?: Record<string, number> }
    : null;
  const rate = data?.rates?.[to];
  const quote = Number.isFinite(rate) && rate && rate > 0 && data?.date
    ? { rate, rate_date: data.date, source: "frankfurter" }
    : await fallbackSnapshot(from, to, date);
  db.prepare(
    `INSERT INTO fx_daily_rates(requested_date,base_currency,quote_currency,rate,rate_date,source,retrieved_at)
     VALUES(?,?,?,?,?,?,?)`,
  ).run(date, from, to, quote.rate, quote.rate_date, quote.source, new Date().toISOString());

  return { amount: convertAmount(amount, quote.rate), ...quote };
}

/**
 * Converter from an entered amount to the base currency at the rate on its own
 * date, so past totals never move with FX (ADR-0001). `pairs` must cover every
 * (currency, date) the converter will see. Future dates and failed lookups use
 * `fallback` (today's rate); failures are retried on the next call.
 */
// ponytail: one dated lookup per missing pair, sequential; move to Frankfurter time-series if first loads get slow.
export async function dailyBaseConverter(
  base: Currency,
  fallback: (amount: number, code: Currency) => number,
  pairs: { currency: Currency | null; date: string }[],
): Promise<(amount: number, currency: Currency | null, date: string) => number> {
  const today = new Date().toISOString().slice(0, 10);
  const rates = new Map<string, number>(); // 0 = lookup failed
  for (const { currency, date } of pairs) {
    const key = `${currency}|${date}`;
    if (!currency || currency === base || date > today || rates.has(key))
      continue;
    try {
      rates.set(key, (await snapshotConversion(1, currency, base, date)).rate);
    } catch {
      rates.set(key, 0);
    }
  }

  return (amount, currency, date) => {
    if (!currency || currency === base)
      return amount;
    const rate = rates.get(`${currency}|${date}`);

    return rate ? amount * rate : fallback(amount, currency);
  };
}

async function fallbackSnapshot(from: string, to: string, date: string): Promise<Omit<FxSnapshot, "amount">> {
  const response = await fetch(
    `${FALLBACK_DAILY_FX_ENDPOINT}@${encodeURIComponent(date)}/v1/currencies/${encodeURIComponent(from.toLowerCase())}.json`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Historical FX lookup failed (${response.status}) for ${from}/${to} on ${date}`);
  const data = await response.json() as { date?: string; [base: string]: unknown };
  const rate = (data[from.toLowerCase()] as Record<string, unknown> | undefined)?.[to.toLowerCase()];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0 || !data.date) {
    throw new Error(`Historical FX quote unavailable for ${from}/${to} on ${date}`);
  }

  return { rate, rate_date: data.date, source: "currency-api" };
}
