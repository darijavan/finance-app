import { assert, test } from "vitest";
import { readFileSync } from "node:fs";

test("mobile tables wrap long descriptions at the compact text size", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 640px)"));

  assert.match(mobileRules, /table\s*\{[^}]*font-size:\s*13px/);
  assert.match(mobileRules, /table\s*\{[^}]*white-space:\s*normal/);
  assert.match(mobileRules, /td:not\(\.actions\)\s*\{[^}]*overflow-wrap:\s*anywhere/);
});

test("all mobile tables scroll while retaining readable data columns", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 640px)"));

  assert.match(mobileRules, /table\s*\{[^}]*display:\s*block[^}]*overflow-x:\s*auto/);
  assert.match(mobileRules, /th:not\(:last-child\),\s*td:not\(\.actions\)\s*\{[^}]*min-width:\s*112px/);
});
