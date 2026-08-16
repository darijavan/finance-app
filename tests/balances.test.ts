import { assert, test } from "vitest";
import { nativeBalances } from "../lib/balances.ts";

test("income adds, expense subtracts", () => {
  const b = nativeBalances([
    { account_id: 1, amount: 100, account_amount: null, direction: "income" },
    { account_id: 1, amount: 30, account_amount: null, direction: "expense" },
  ], []);
  assert.equal(b.get(1), 70);
});

test("snapshot account_amount takes precedence over entered amount", () => {
  const b = nativeBalances([
    { account_id: 1, amount: 10, account_amount: 36.53, direction: "expense" },
  ], []);
  assert.equal(b.get(1), -36.53);
});

test("transfers move value between accounts using per-side snapshots", () => {
  const b = nativeBalances([], [
    { from_account: 1, to_account: 2, amount: 100, from_amount: 100, to_amount: 33 },
  ]);
  assert.equal(b.get(1), -100);
  assert.equal(b.get(2), 33);
});

test("transfers fall back to the entered amount without snapshots", () => {
  const b = nativeBalances([], [
    { from_account: 1, to_account: 2, amount: 50, from_amount: null, to_amount: null },
  ]);
  assert.equal(b.get(1), -50);
  assert.equal(b.get(2), 50);
});

test("month-end balances exclude later transactions and transfers", () => {
  const b = nativeBalances(
    [
      { account_id: 1, amount: 100, account_amount: null, direction: "income", date: "2026-07-31" },
      { account_id: 1, amount: 50, account_amount: null, direction: "income", date: "2026-08-01" },
    ],
    [{ from_account: 1, to_account: 2, amount: 20, from_amount: 20, to_amount: 20, date: "2026-08-01" }],
    "2026-07-31",
  );
  assert.equal(b.get(1), 100);
  assert.equal(b.get(2), undefined);
});