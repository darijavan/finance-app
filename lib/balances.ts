// Pure native-currency balance aggregation, shared by the accounts API and tests.
// Snapshot columns (account_amount / from_amount / to_amount) take precedence so
// later FX changes never rewrite the value of a past transaction or transfer.

export interface TxRow {
  account_id: number;
  amount: number;
  account_amount: number | null;
  direction: string;
}

export interface TransferRow {
  from_account: number;
  to_account: number;
  amount: number;
  from_amount: number | null;
  to_amount: number | null;
}

export function nativeBalances(txs: TxRow[], transfers: TransferRow[]): Map<number, number> {
  const native = new Map<number, number>();
  const bump = (id: number, v: number) => native.set(id, (native.get(id) || 0) + v);
  for (const t of txs) {
    const value = t.account_amount ?? t.amount;
    bump(t.account_id, t.direction === "expense" ? -value : value);
  }
  for (const x of transfers) {
    bump(x.from_account, -(x.from_amount ?? x.amount));
    bump(x.to_account, x.to_amount ?? x.amount);
  }
  return native;
}
