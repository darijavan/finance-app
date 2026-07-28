import type { Currency } from "./currency.ts";
import { getDb } from "./db.ts";

const DAILY_FX_ENDPOINT = "https://api.frankfurter.dev/v1";

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
  if (!response.ok) throw new Error(`Historical FX lookup failed (${response.status}) for ${from}/${to} on ${date}`);
  const data = await response.json() as { date?: string; rates?: Record<string, number> };
  const rate = data.rates?.[to];
  if (!Number.isFinite(rate) || !rate || rate <= 0 || !data.date) {
    throw new Error(`Historical FX quote unavailable for ${from}/${to} on ${date}`);
  }
  const source = "frankfurter";
  db.prepare(
    `INSERT INTO fx_daily_rates(requested_date,base_currency,quote_currency,rate,rate_date,source,retrieved_at)
     VALUES(?,?,?,?,?,?,?)`,
  ).run(date, from, to, rate, data.date, source, new Date().toISOString());
  

  return { amount: convertAmount(amount, rate), rate, rate_date: data.date, source };
}
