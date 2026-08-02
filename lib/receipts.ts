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

export function receiptMime(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  let mime: string | null = null;
  if (buffer.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
  else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mime = "image/jpeg";
  else if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) mime = "image/png";
  else if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") mime = "image/webp";

  return mime;
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
