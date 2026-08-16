import { assert, test } from "vitest";
import { booleanParam, money, moneyOrZero, currency, oneOf, isoDate, isoMonth, optionalId, intInRange } from "../lib/validate.ts";

test("money accepts finite positive values, absolutizes, rejects garbage", () => {
  assert.strictEqual(money("12.5"), 12.5);
  assert.strictEqual(money(-5), 5);
  assert.strictEqual(money(0), null);
  assert.strictEqual(money(Infinity), null);
  assert.strictEqual(money(NaN), null);
  assert.strictEqual(money("abc"), null);
  assert.strictEqual(money(null), null);
});

test("moneyOrZero additionally allows zero", () => {
  assert.strictEqual(moneyOrZero(0), 0);
  assert.strictEqual(moneyOrZero("1e999"), null);
});

test("currency normalizes supported codes and rejects others", () => {
  assert.strictEqual(currency("usd"), "USD");
  assert.strictEqual(currency(" eur "), "EUR");
  assert.strictEqual(currency("", "ILS"), "ILS");
  assert.strictEqual(currency(null), "ILS");
  assert.strictEqual(currency("MGA"), "MGA");
  assert.strictEqual(currency("CAD"), null);
  assert.strictEqual(currency("DOLLARS"), null);
  assert.strictEqual(currency("U$"), null);
});

test("oneOf falls back on anything outside the enum", () => {
  assert.strictEqual(oneOf("income", ["expense", "income"] as const, "expense"), "income");
  assert.strictEqual(oneOf("DROP TABLE", ["expense", "income"] as const, "expense"), "expense");
});

test("booleanParam accepts explicit query values only", () => {
  assert.strictEqual(booleanParam("1"), true);
  assert.strictEqual(booleanParam("0"), false);
  assert.strictEqual(booleanParam(null), undefined);
  assert.strictEqual(booleanParam("true"), undefined);
});

test("isoDate / isoMonth enforce calendar shape", () => {
  assert.strictEqual(isoDate("2026-07-21"), "2026-07-21");
  assert.strictEqual(isoDate("21/07/2026"), null);
  assert.strictEqual(isoMonth("2026-07"), "2026-07");
  assert.strictEqual(isoMonth("2026-07-21"), null);
  assert.strictEqual(isoMonth("2026-13"), null);
});

test("optionalId: null-ish is null, integers pass, garbage is undefined", () => {
  assert.strictEqual(optionalId(null), null);
  assert.strictEqual(optionalId(""), null);
  assert.strictEqual(optionalId("3"), 3);
  assert.strictEqual(optionalId(3.5), undefined);
  assert.strictEqual(optionalId("x"), undefined);
  assert.strictEqual(optionalId(0), undefined);
});

test("intInRange clamps and falls back", () => {
  assert.strictEqual(intInRange(31, 1, 28, 1), 28);
  assert.strictEqual(intInRange("7", 1, 28, 1), 7);
  assert.strictEqual(intInRange("x", 1, 28, 1), 1);
});