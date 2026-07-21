import { test } from "node:test";
import assert from "node:assert/strict";
import { chargeDate, cutoffDay } from "../lib/subscription-due.ts";

const monthly = { frequency: "monthly", day_of_month: 10, month_of_year: null, start_date: null };
const TODAY = "2026-07-21";

test("cutoff: past months backfill fully, current month up to today, future never", () => {
  assert.equal(cutoffDay("2026-06", TODAY), 28);
  assert.equal(cutoffDay("2026-07", TODAY), 21);
  assert.equal(cutoffDay("2026-08", TODAY), 0);
});

test("monthly charge lands on its day when already due", () => {
  assert.equal(chargeDate(monthly, "2026-07", TODAY), "2026-07-10");
});

test("monthly charge not yet due this month is skipped", () => {
  assert.equal(chargeDate({ ...monthly, day_of_month: 25 }, "2026-07", TODAY), null);
});

test("future months are never charged", () => {
  assert.equal(chargeDate(monthly, "2026-08", TODAY), null);
});

test("past months backfill even for late days", () => {
  assert.equal(chargeDate({ ...monthly, day_of_month: 28 }, "2026-06", TODAY), "2026-06-28");
});

test("day of month clamps to 28", () => {
  assert.equal(chargeDate({ ...monthly, day_of_month: 31 }, "2026-06", TODAY), "2026-06-28");
});

test("missing day defaults to the 1st", () => {
  assert.equal(chargeDate({ ...monthly, day_of_month: null }, "2026-07", TODAY), "2026-07-01");
});

test("no charge before the subscription's start date", () => {
  assert.equal(chargeDate({ ...monthly, start_date: "2026-07-15" }, "2026-07", TODAY), null);
  assert.equal(chargeDate({ ...monthly, start_date: "2026-07-10" }, "2026-07", TODAY), "2026-07-10");
  assert.equal(chargeDate({ ...monthly, start_date: "2026-01-01" }, "2026-06", TODAY), "2026-06-10");
});

test("yearly charges only in its month", () => {
  const yearly = { frequency: "yearly", day_of_month: 5, month_of_year: 7, start_date: null };
  assert.equal(chargeDate(yearly, "2026-07", TODAY), "2026-07-05");
  assert.equal(chargeDate(yearly, "2026-06", TODAY), null);
  assert.equal(chargeDate({ ...yearly, month_of_year: 6 }, "2026-06", TODAY), "2026-06-05");
});

test("unknown frequency never charges", () => {
  assert.equal(chargeDate({ ...monthly, frequency: "weekly" }, "2026-07", TODAY), null);
});
