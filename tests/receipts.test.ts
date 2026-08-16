import { assert, test } from "vitest";
import { MAX_RECEIPT_BYTES, receiptMime, receiptName, validReceipt } from "../lib/receipts.ts";

test("receipts accept only non-empty PDFs and images within the size limit", () => {
  assert.strictEqual(validReceipt({ type: "application/pdf", size: 1 }), true);
  assert.strictEqual(validReceipt({ type: "image/png", size: MAX_RECEIPT_BYTES }), true);
  assert.strictEqual(validReceipt({ type: "text/html", size: 1 }), false);
  assert.strictEqual(validReceipt({ type: "image/jpeg", size: 0 }), false);
  assert.strictEqual(validReceipt({ type: "image/jpeg", size: MAX_RECEIPT_BYTES + 1 }), false);
});

test("receipt filenames cannot introduce paths or headers", () => {
  assert.strictEqual(receiptName("../../receipt\".pdf"), "receipt_.pdf");
});

test("receipt magic bytes must match a safe file type", () => {
  assert.strictEqual(receiptMime(Buffer.from("%PDF-1.7")), "application/pdf");
  assert.strictEqual(receiptMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.strictEqual(receiptMime(Buffer.from("<html>")), null);
});