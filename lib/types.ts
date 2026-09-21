import type { Currency } from "./currency.ts";
import type { Insight } from "./insights.ts";

export interface Category {
  id: number;
  name: string;
  color: string;
  direction: "expense" | "income";
}

export interface Transaction {
  id: number;
  amount: number;
  currency: Currency;
  direction: "expense" | "income";
  category_id: number | null;
  date: string; // YYYY-MM-DD
  note: string;
  account_id: number | null;
  account_amount: number | null; // immutable account-currency amount on the transaction date
  account_currency: Currency | null;
  subscription_id: number | null;
  is_subscription_charge: boolean;
  reimbursable: boolean;
  reimbursed_at: string | null;
  receipt_name: string | null;
  receipt_mime: string | null;
  created_at: string;
  category_name?: string;
  category_color?: string;
  account_name?: string;
}

export type AccountType = "bank" | "cash" | "card" | "other";

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  currency: Currency;
  active: boolean;
  note: string;
  sort_order: number;
  balance?: number; // native-currency balance, populated by the API
  base_balance?: number; // current display/base valuation of the native balance
}

export interface Transfer {
  id: number;
  amount: number;
  currency: Currency;
  from_account: number;
  to_account: number;
  date: string;
  note: string;
  created_at: string;
  from_amount: number | null; // immutable debit in the origin account's currency
  from_currency: Currency | null;
  to_amount: number | null; // immutable credit in the destination account's currency
  to_currency: Currency | null;
  from_name?: string;
  to_name?: string;
}

export type Frequency = "monthly" | "yearly";

export interface Subscription {
  id: number;
  name: string;
  amount: number;
  currency: Currency;
  direction: "expense" | "income";
  category_id: number | null;
  frequency: Frequency;
  day_of_month: number;
  month_of_year: number | null; // 1-12 for yearly
  active: boolean;
  note: string;
  start_date: string | null; // YYYY-MM-DD when the subscription began
  account_id: number | null; // which account it's charged from
  category_name?: string;
  category_color?: string;
  account_name?: string;
  monthly_equivalent?: number | null;
  last_charge_amount?: number | null; // amount of the most recent automatic charge
  last_charge_currency?: Currency | null; // native currency of the most recent automatic charge
  last_charge_id?: number | null;
  last_charge_account_amount?: number | null;
  last_charge_account_currency?: Currency | null;
  last_charge_date?: string | null;
}

export interface Budget {
  id: number;
  category_id: number | null; // null = overall
  month: string; // YYYY-MM
  amount: number;
  rollover?: number; // 1 = unused budget carries into the next month
  category_name?: string;
  category_color?: string;
}

export interface ActivityEntry {
  id: number;
  entity: string;
  action: string;
  entity_id: number | null;
  summary: string;
  created_at: string;
  undoable: boolean;
}

export interface Goal {
  id: number;
  name: string;
  target_amount: number;
  account_id: number;
  target_date: string | null;
  note: string;
  account_name?: string;
  currency?: Currency; // linked account's currency (targets are in it)
  current?: number; // linked account's native balance
}

export interface TrendPoint {
  month: string;
  spent: number;
  earned: number;
  net_worth: number;
}

export interface Summary {
  month: string;
  base?: Currency;
  spent: number;
  earned: number;
  net: number;
  remaining: number;
  recurring_monthly: number;
  remaining_subscriptions: number;
  due_subscriptions: { id: number; name: string; amount: number; currency: Currency; date: string; overdue: boolean }[];
  reimbursable_expenses: { id: number; date: string; note: string; category_name: string; amount: number; currency: Currency }[];
  remaining_reimbursements: number;
  insights: Insight[];
  by_category: { name: string; color: string; total: number }[];
  budgets: {
    category_id: number | null;
    category_name: string;
    color: string;
    budget: number;
    actual: number;
    rollover?: boolean;
  }[];
}

export interface StatementImportRow {
  id: number;
  import_id: number;
  row_index: number;
  date: string;
  amount: number;
  direction: "expense" | "income";
  note: string;
  status: "new" | "exact_duplicate" | "possible_duplicate";
  matched_transaction_id: number | null;
}

export interface StatementImport {
  id: number;
  source: string;
  source_fingerprint: string;
  account_id: number;
  currency: Currency;
  status: "draft" | "applied" | "rejected";
  created_at: string;
  rows?: StatementImportRow[];
}

export interface Settings {
  currency: Currency;
  currency_symbol: string;
}
