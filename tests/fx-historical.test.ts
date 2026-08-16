import { assert, test } from "vitest";
import { convertAmount } from "../lib/fx-historical.ts";

test("convertAmount rounds immutable historical FX values and rejects invalid rates", () => {
  assert.strictEqual(convertAmount(11.99, 3.0464), 36.53);
  assert.strictEqual(convertAmount(70, 1), 70);
  assert.throws(() => convertAmount(10, 0), /positive/);
});