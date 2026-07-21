import assert from "node:assert/strict";
import { convertAmount } from "../lib/fx-historical.ts";

// A dated provider quote means 1 USD = 3.0464 ILS on 2026-07-20.
// The stored converted amount must be immutable and rounded to cents.
assert.equal(convertAmount(11.99, 3.0464), 36.53);
assert.equal(convertAmount(70, 1), 70);
assert.throws(() => convertAmount(10, 0), /positive/);

console.log("fx-historical tests passed");
