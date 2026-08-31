import { assert, test } from "vitest";
import { readFileSync } from "node:fs";

test("mobile tables use one compact text size", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf("@media (max-width: 640px)"));

  assert.match(mobileRules, /table\s*\{[^}]*font-size:\s*13px/);
});
