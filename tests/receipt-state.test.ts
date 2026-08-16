import { assert, test } from "vitest";
import { withReceiptName } from "../lib/receipt-state.ts";

test("receipt upload updates the matching visible transaction immediately", () => {
  const rows = [{ id: 1, receipt_name: null }, { id: 2, receipt_name: "old.jpg" }];
  assert.deepStrictEqual(withReceiptName(rows, 1, "receipt.pdf"), [
    { id: 1, receipt_name: "receipt.pdf" },
    { id: 2, receipt_name: "old.jpg" },
  ]);
});