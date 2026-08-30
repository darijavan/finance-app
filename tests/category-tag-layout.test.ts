import { assert, test } from "vitest";
import { readFileSync } from "node:fs";

test("category tags stay on one line in transaction tables", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.tag\s*\{[^}]*white-space:\s*nowrap/);
});
