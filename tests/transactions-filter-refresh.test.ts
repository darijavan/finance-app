import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const store = readFileSync(new URL("../app/(finance)/store.tsx", import.meta.url), "utf8");
const transactions = readFileSync(new URL("../app/(finance)/transactions/page.tsx", import.meta.url), "utf8");

test("active transaction filters refetch after a shared reload", () => {
  assert.match(store, /transfers, reloadKey, reload, reloadCategories/);
  assert.match(transactions, /incomeCats, reloadKey, reload, notify, confirm, undo/);
  assert.match(transactions, /fReimbursable, reloadKey, notify\]\);/);
});
