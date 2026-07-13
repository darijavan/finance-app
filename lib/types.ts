export interface Category {
  id: number;
  name: string;
  color: string;
  direction: "expense" | "income";
}

export interface Transaction {
  id: number;
  amount: number;
  currency: string;
  direction: "expense" | "income";
  category_id: number | null;
  date: string; // YYYY-MM-DD
  note: string;
  created_at: string;
  category_name?: string;
  category_color?: string;
}

export type Frequency = "monthly" | "yearly";

export interface Subscription {
  id: number;
  name: string;
  amount: number;
  currency: string;
  direction: "expense" | "income";
  category_id: number | null;
  frequency: Frequency;
  day_of_month: number;
  month_of_year: number | null; // 1-12 for yearly
  active: boolean;
  note: string;
  category_name?: string;
  category_color?: string;
  monthly_equivalent?: number;
}

export interface Budget {
  id: number;
  category_id: number | null; // null = overall
  month: string; // YYYY-MM
  amount: number;
  category_name?: string;
  category_color?: string;
}

export interface Summary {
  month: string;
  base?: string;
  spent: number;
  earned: number;
  net: number;
  remaining: number;
  recurring_monthly: number;
  by_category: { name: string; color: string; total: number }[];
  budgets: {
    category_id: number | null;
    category_name: string;
    color: string;
    budget: number;
    actual: number;
  }[];
}

export interface Settings {
  currency: string;
  currency_symbol: string;
}
