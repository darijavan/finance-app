import { assert, test } from "vitest";
import { readFileSync } from "node:fs";

test("mobile form controls can shrink within a two-column row", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 640px)"));

  assert.match(mobileRules, /\.row \.field \{[^}]*min-width:\s*0/);
  assert.match(mobileRules, /\.row \.field input\[type="date"\]\s*\{[^}]*min-inline-size:\s*0[^}]*-webkit-appearance:\s*none/);
  assert.match(mobileRules, /\.currency-select\s*\{[^}]*width:\s*100%/);
});