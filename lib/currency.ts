export const CURRENCIES = [
  { code: "ILS", symbol: "₪" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "JPY", symbol: "¥" },
  { code: "MGA", symbol: "Ar" },
] as const;

export type Currency = (typeof CURRENCIES)[number]["code"];

export const DEFAULT_CURRENCY: Currency = "ILS";

export function isCurrency(value: string): value is Currency {

  return CURRENCIES.some((currency) => currency.code === value);
}
