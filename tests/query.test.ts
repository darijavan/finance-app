import assert from "node:assert/strict";
import { test } from "node:test";
import { withQueryParam } from "../lib/query.ts";

test("query filters preserve unrelated state and omit empty filters", () => {
  assert.equal(withQueryParam("month=2026-08&q=rent", "account", "4"), "month=2026-08&q=rent&account=4");
  assert.equal(withQueryParam("month=2026-08&q=rent", "q", ""), "month=2026-08");
});
