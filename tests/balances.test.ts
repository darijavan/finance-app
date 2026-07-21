import { test } from "node:test";
import assert from "node:assert/strict";
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
