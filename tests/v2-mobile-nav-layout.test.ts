import { assert, test } from "vitest";
import { readFileSync } from "node:fs";

// Regression guard: the v2 beta's collapsed sidebar becomes a flex row on
// mobile with the brand+nav wrapper as one flex item. Without min-width: 0 on
// that wrapper (and the nav inside it), the item refuses to shrink below the
// nav's full unscrolled content width, pushing the entire page into
// horizontal overflow instead of letting the nav scroll internally.
test("v2 mobile sidebar-head and nav can shrink instead of overflowing the page", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf('@media (max-width: 860px)'));

  assert.match(mobileRules, /\.sidebar-head\s*\{[^}]*min-width:\s*0/);
  assert.match(mobileRules, /\.sidebar \.nav\s*\{[^}]*min-width:\s*0/);
  // Nav links and the currency/month/beta controls must meet the 44px touch target.
  assert.match(mobileRules, /\.sidebar \.nav a\s*\{[^}]*min-height:\s*44px/);
  assert.match(mobileRules, /\.selector\s*\{[^}]*min-height:\s*44px/);
});
