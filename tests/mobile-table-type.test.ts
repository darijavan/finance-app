import { assert, test } from "vitest";
import { readFileSync } from "node:fs";

test("mobile tables wrap long descriptions at the compact text size", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 640px)"));

  assert.match(mobileRules, /table\s*\{[^}]*font-size:\s*13px/);
  assert.match(mobileRules, /table\s*\{[^}]*white-space:\s*normal/);
  assert.match(mobileRules, /td:not\(\.actions\)\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("transfer history keeps its columns readable inside a scroll container", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.table-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.transfer-table\s*\{[^}]*min-width:\s*760px/);
});
