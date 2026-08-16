import { assert, test } from "vitest";
import { classifyRows, normaliseMerchant, sourceFingerprint } from "../lib/statement-import.ts";

test("normaliseMerchant removes statement noise without changing words", () => {
  assert.strictEqual(normaliseMerchant("  Foo   Store  * 1234  "), "FOO STORE");
});

test("classifyRows distinguishes exact and possible duplicates", () => {
  const rows = [
    { date: "2026-07-16", amount: 12.5, direction: "expense" as const, note: "Adobe*1234" },
    { date: "2026-07-17", amount: 12.5, direction: "expense" as const, note: "Adobe" },
    { date: "2026-07-17", amount: 8, direction: "expense" as const, note: "Groceries" },
  ];
  const existing = [{ id: 9, date: "2026-07-16", amount: 12.5, direction: "expense" as const, note: "ADOBE" }];
  assert.deepStrictEqual(classifyRows(rows, existing).map((row) => row.status), ["exact_duplicate", "possible_duplicate", "new"]);
});

test("sourceFingerprint is deterministic and account-specific", async () => {
  assert.strictEqual(await sourceFingerprint(2, "fixture"), await sourceFingerprint(2, "fixture"));
  assert.notStrictEqual(await sourceFingerprint(2, "fixture"), await sourceFingerprint(3, "fixture"));
});