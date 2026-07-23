import { test } from "node:test";
import assert from "node:assert/strict";
import { chargeDate, cutoffDay, nextChargeDate, scheduledDateInMonth } from "../lib/subscription-due.ts";

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

test("scheduled date remains available for an unpaid upcoming subscription", () => {
  assert.equal(scheduledDateInMonth({ ...monthly, day_of_month: 25 }, "2026-07"), "2026-07-25");
  assert.equal(scheduledDateInMonth({ ...monthly, day_of_month: 31 }, "2026-07"), "2026-07-28");
  const yearly = { frequency: "yearly", day_of_month: 5, month_of_year: 3, start_date: null };
  assert.equal(scheduledDateInMonth(yearly, "2026-03"), "2026-03-05");
  assert.equal(scheduledDateInMonth(yearly, "2026-07"), null);
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

test("nextChargeDate finds the upcoming occurrence", () => {
  assert.equal(nextChargeDate(monthly, TODAY), "2026-08-10"); // day 10 already passed
  assert.equal(nextChargeDate({ ...monthly, day_of_month: 25 }, TODAY), "2026-07-25");
  assert.equal(nextChargeDate({ ...monthly, day_of_month: 21 }, TODAY), "2026-07-21"); // today counts
  const yearly = { frequency: "yearly", day_of_month: 5, month_of_year: 7, start_date: null };
  assert.equal(nextChargeDate(yearly, TODAY), "2027-07-05"); // July 5 passed -> next year
  assert.equal(nextChargeDate({ ...yearly, month_of_year: 9 }, TODAY), "2026-09-05");
  assert.equal(nextChargeDate({ ...monthly, start_date: "2026-10-01" }, TODAY), "2026-10-10");
  assert.equal(nextChargeDate({ ...monthly, frequency: "weekly" }, TODAY), null);
});

test("unknown frequency never charges", () => {
  assert.equal(chargeDate({ ...monthly, frequency: "weekly" }, "2026-07", TODAY), null);
});
