import * as path from "node:path";

const RECEIPTS_DIR = path.join(process.cwd(), "data", "receipts");
const RECEIPT_KEY = /^[0-9a-f-]{36}$/;

export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function validReceipt(file: { type: string; size: number }) {


  return RECEIPT_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_RECEIPT_BYTES;
}

export function receiptName(name: string) {
  const cleaned = path.basename(name).replace(/[^\w.-]/g, "_");

  return cleaned || "receipt";
}

export function receiptDir() {

  return RECEIPTS_DIR;
}

export function receiptPath(key: string) {
  if (!RECEIPT_KEY.test(key)) throw new Error("invalid receipt key");

  return path.join(RECEIPTS_DIR, key);
}
