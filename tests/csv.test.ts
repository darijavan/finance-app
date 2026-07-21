import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCSV, toCSV, normalizeDate, normalizeAmount } from "../lib/csv.ts";

test("parseCSV handles quotes, embedded commas and newlines", () => {
  assert.deepEqual(parseCSV('a,b\n1,"x, y"\n2,"he said ""hi""\nline2"'), [
    ["a", "b"],
    ["1", "x, y"],
    ["2", 'he said "hi"\nline2'],
  ]);
});

test("parseCSV drops empty trailing rows and handles CRLF", () => {
  assert.deepEqual(parseCSV("a,b\r\n1,2\r\n\r\n"), [["a", "b"], ["1", "2"]]);
});

test("toCSV round-trips through parseCSV", () => {
  const rows = [["date", "note"], ["2026-07-01", 'has "quotes", commas']];
  assert.deepEqual(parseCSV(toCSV(rows)), rows);
});

test("normalizeDate handles common statement layouts", () => {
  assert.equal(normalizeDate("2026-07-21"), "2026-07-21");
  assert.equal(normalizeDate("2026/07/21"), "2026-07-21");
  assert.equal(normalizeDate("21/07/2026"), "2026-07-21"); // day > 12 -> DMY
  assert.equal(normalizeDate("07/21/2026"), "2026-07-21"); // month > 12 -> MDY
  assert.equal(normalizeDate("05/06/2026", "dmy"), "2026-06-05");
  assert.equal(normalizeDate("05/06/2026", "mdy"), "2026-05-06");
  assert.equal(normalizeDate("05/06/2026"), "2026-06-05"); // ambiguous auto -> DMY
  assert.equal(normalizeDate("not a date"), null);
  assert.equal(normalizeDate("13/13/2026"), null);
});

test("normalizeAmount strips symbols and both separator conventions", () => {
  assert.equal(normalizeAmount("₪1,234.56"), 1234.56);
  assert.equal(normalizeAmount("1.234,56"), 1234.56);
  assert.equal(normalizeAmount("-42"), -42);
  assert.equal(normalizeAmount("(42.50)"), -42.5);
  assert.equal(normalizeAmount("$ 7"), 7);
  assert.equal(normalizeAmount(""), null);
  assert.equal(normalizeAmount("abc"), null);
});
