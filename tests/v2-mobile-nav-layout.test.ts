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

  assert.match(mobileRules, /\.sidebar\s*\{[^}]*width:\s*100%[^}]*align-self:\s*stretch/);
  assert.match(mobileRules, /\.sidebar-head\s*\{[^}]*min-width:\s*0/);
  assert.match(mobileRules, /\.sidebar \.nav\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%/);
  // Nav links and the currency/month/beta controls must meet the 44px touch target.
  assert.match(mobileRules, /\.sidebar \.nav a\s*\{[^}]*min-height:\s*44px/);
  assert.match(mobileRules, /\.selector\s*\{[^}]*min-height:\s*44px/);
  assert.match(mobileRules, /\.month-picker\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 44px/);
});

test("legacy mobile header keeps the beta switch inside its control grid", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf('@media (max-width: 640px)'));

  assert.match(mobileRules, /\[data-design="current"\] \.month-picker\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 44px/);
  assert.match(mobileRules, /\[data-design="current"\] \.month-picker > select\s*\{[^}]*min-width:\s*0[^}]*width:\s*100%/);
  assert.match(mobileRules, /\[data-design="current"\] \.design-toggle\s*\{[^}]*width:\s*44px/);
});
