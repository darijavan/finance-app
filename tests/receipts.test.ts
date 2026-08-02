import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_RECEIPT_BYTES, receiptName, validReceipt } from "../lib/receipts.ts";

test("receipts accept only non-empty PDFs and images within the size limit", () => {
  assert.equal(validReceipt({ type: "application/pdf", size: 1 }), true);
  assert.equal(validReceipt({ type: "image/png", size: MAX_RECEIPT_BYTES }), true);
  assert.equal(validReceipt({ type: "text/html", size: 1 }), false);
  assert.equal(validReceipt({ type: "image/jpeg", size: 0 }), false);
  assert.equal(validReceipt({ type: "image/jpeg", size: MAX_RECEIPT_BYTES + 1 }), false);
});

test("receipt filenames cannot introduce paths or headers", () => {
  assert.equal(receiptName("../../receipt\".pdf"), "receipt_.pdf");
});
