import { assert, test } from "vitest";
import { booleanParam, money, moneyOrZero, currency, oneOf, isoDate, isoMonth, optionalId, intInRange } from "../lib/validate.ts";

test("money accepts finite positive values, absolutizes, rejects garbage", () => {
  assert.equal(money("12.5"), 12.5);
  assert.equal(money(-5), 5);
  assert.equal(money(0), null);
  assert.equal(money(Infinity), null);
  assert.equal(money(NaN), null);
  assert.equal(money("abc"), null);
  assert.equal(money(null), null);
});

test("moneyOrZero additionally allows zero", () => {
  assert.equal(moneyOrZero(0), 0);
  assert.equal(moneyOrZero("1e999"), null);
});

test("currency normalizes supported codes and rejects others", () => {
  assert.equal(currency("usd"), "USD");
  assert.equal(currency(" eur "), "EUR");
  assert.equal(currency("", "ILS"), "ILS");
  assert.equal(currency(null), "ILS");
  assert.equal(currency("MGA"), "MGA");
  assert.equal(currency("CAD"), null);
  assert.equal(currency("DOLLARS"), null);
  assert.equal(currency("U$"), null);
});

test("oneOf falls back on anything outside the enum", () => {
  assert.equal(oneOf("income", ["expense", "income"] as const, "expense"), "income");
  assert.equal(oneOf("DROP TABLE", ["expense", "income"] as const, "expense"), "expense");
});

test("booleanParam accepts explicit query values only", () => {
  assert.equal(booleanParam("1"), true);
  assert.equal(booleanParam("0"), false);
  assert.equal(booleanParam(null), undefined);
  assert.equal(booleanParam("true"), undefined);
});

test("isoDate / isoMonth enforce calendar shape", () => {
  assert.equal(isoDate("2026-07-21"), "2026-07-21");
  assert.equal(isoDate("21/07/2026"), null);
  assert.equal(isoMonth("2026-07"), "2026-07");
  assert.equal(isoMonth("2026-07-21"), null);
  assert.equal(isoMonth("2026-13"), null);
});

test("optionalId: null-ish is null, integers pass, garbage is undefined", () => {
  assert.equal(optionalId(null), null);
  assert.equal(optionalId(""), null);
  assert.equal(optionalId("3"), 3);
  assert.equal(optionalId(3.5), undefined);
  assert.equal(optionalId("x"), undefined);
  assert.equal(optionalId(0), undefined);
});

test("intInRange clamps and falls back", () => {
  assert.equal(intInRange(31, 1, 28, 1), 28);
  assert.equal(intInRange("7", 1, 28, 1), 7);
  assert.equal(intInRange("x", 1, 28, 1), 1);
});