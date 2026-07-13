import { getDb } from "./db";

// Exchange rates are stored relative to the app's BASE currency (the settings
// `currency`, normally ILS). rate[code] = how many units of `code` equal 1 base
// unit. So to convert an amount expressed in `code` back into base currency:
//   base_amount = amount / rate[code]
// The base currency itself always has rate 1.

const REFRESH_MS = 12 * 60 * 60 * 1000; // 12h — daily-ish, avoids hammering the API
const ENDPOINT = "https://open.er-api.com/v6/latest"; // keyless, no signup

export function getBaseCurrency(): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key='currency'").get() as
    | { value: string }
    | undefined;
  return row?.value || "ILS";
}

function readRates(): Record<string, { rate: number; updated_at: string }> {
  const db = getDb();
  const rows = db.prepare("SELECT code, rate, updated_at FROM fx_rates").all() as any[];
  const out: Record<string, { rate: number; updated_at: string }> = {};
  for (const r of rows) out[r.code] = { rate: r.rate, updated_at: r.updated_at };
  return out;
}

function ratesAreStale(rates: Record<string, { updated_at: string }>): boolean {
  const vals = Object.values(rates);
  if (vals.length === 0) return true;
  const newest = Math.max(...vals.map((v) => Date.parse(v.updated_at) || 0));
  return Date.now() - newest > REFRESH_MS;
}

// Fetch fresh rates from the API and persist them (keyed to the current base).
export async function refreshRates(force = false): Promise<Record<string, number>> {
  const base = getBaseCurrency();
  const db = getDb();
  const existing = readRates();
  // If existing rates were stored against a different base, force a refresh.
  const baseRow = existing[base];
  const baseMismatch = baseRow != null && Math.abs(baseRow.rate - 1) > 1e-9;

  if (!force && !baseMismatch && !ratesAreStale(existing)) {
    const out: Record<string, number> = {};
    for (const [c, v] of Object.entries(existing)) out[c] = v.rate;
    return out;
  }

  try {
    const res = await fetch(`${ENDPOINT}/${base}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`fx http ${res.status}`);
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates) throw new Error("fx bad payload");
    const now = new Date().toISOString();
    const upsert = db.prepare(
      "INSERT INTO fx_rates(code,rate,updated_at) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET rate=excluded.rate, updated_at=excluded.updated_at"
    );
    db.exec("BEGIN");
    try {
      for (const [code, rate] of Object.entries(data.rates)) upsert.run(code, rate, now);
      upsert.run(base, 1, now);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    return data.rates;
  } catch (e) {
    // Network/API failure: fall back to whatever we have cached (may be empty).
    const out: Record<string, number> = { [base]: 1 };
    for (const [c, v] of Object.entries(existing)) out[c] = v.rate;
    return out;
  }
}

// Return a converter that turns an amount in currency `code` into base currency.
// Falls back to 1:1 for unknown currencies (better than dropping the value).
export async function getConverter(): Promise<{
  base: string;
  toBase: (amount: number, code: string) => number;
  rates: Record<string, number>;
}> {
  const base = getBaseCurrency();
  const rates = await refreshRates();
  rates[base] = 1;
  const toBase = (amount: number, code: string): number => {
    const r = rates[code];
    if (!r || r <= 0) return amount; // unknown currency -> assume already base
    return amount / r;
  };
  return { base, toBase, rates };
}
