import { assert, test } from "vitest";
import { withQueryParam } from "../lib/query.ts";

test("query filters preserve unrelated state and omit empty filters", () => {
  assert.strictEqual(withQueryParam("month=2026-08&q=rent", "account", "4"), "month=2026-08&q=rent&account=4");
  assert.strictEqual(withQueryParam("month=2026-08&q=rent", "q", ""), "month=2026-08");
  assert.strictEqual(withQueryParam("month=2026-08&q=rent", "month", "2026-07"), "month=2026-07&q=rent");
});