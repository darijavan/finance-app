import { assert, test } from "vitest";
import { parseCSV, toCSV, normalizeDate, normalizeAmount } from "../lib/csv.ts";

test("parseCSV handles quotes, embedded commas and newlines", () => {
  assert.deepStrictEqual(parseCSV('a,b\n1,"x, y"\n2,"he said ""hi""\nline2"'), [
    ["a", "b"],
    ["1", "x, y"],
    ["2", 'he said "hi"\nline2'],
  ]);
});

test("parseCSV drops empty trailing rows and handles CRLF", () => {
  assert.deepStrictEqual(parseCSV("a,b\r\n1,2\r\n\r\n"), [["a", "b"], ["1", "2"]]);
});

test("toCSV round-trips through parseCSV", () => {
  const rows = [["date", "note"], ["2026-07-01", 'has "quotes", commas']];
  assert.deepStrictEqual(parseCSV(toCSV(rows)), rows);
});

test("normalizeDate handles common statement layouts", () => {
  assert.strictEqual(normalizeDate("2026-07-21"), "2026-07-21");
  assert.strictEqual(normalizeDate("2026/07/21"), "2026-07-21");
  assert.strictEqual(normalizeDate("21/07/2026"), "2026-07-21"); // day > 12 -> DMY
  assert.strictEqual(normalizeDate("07/21/2026"), "2026-07-21"); // month > 12 -> MDY
  assert.strictEqual(normalizeDate("05/06/2026", "dmy"), "2026-06-05");
  assert.strictEqual(normalizeDate("05/06/2026", "mdy"), "2026-05-06");
  assert.strictEqual(normalizeDate("05/06/2026"), "2026-06-05"); // ambiguous auto -> DMY
  assert.strictEqual(normalizeDate("not a date"), null);
  assert.strictEqual(normalizeDate("13/13/2026"), null);
});

test("normalizeAmount strips symbols and both separator conventions", () => {
  assert.strictEqual(normalizeAmount("₪1,234.56"), 1234.56);
  assert.strictEqual(normalizeAmount("1.234,56"), 1234.56);
  assert.strictEqual(normalizeAmount("-42"), -42);
  assert.strictEqual(normalizeAmount("(42.50)"), -42.5);
  assert.strictEqual(normalizeAmount("$ 7"), 7);
  assert.strictEqual(normalizeAmount(""), null);
  assert.strictEqual(normalizeAmount("abc"), null);
});