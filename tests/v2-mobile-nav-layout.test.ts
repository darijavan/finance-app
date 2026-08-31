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
  assert.match(mobileRules, /\.topbar\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 44px/);
  assert.match(mobileRules, /\.month-picker\s*\{[^}]*display:\s*contents/);
});

test("legacy mobile header keeps the beta switch inside its control grid", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const mobileRules = css.slice(css.indexOf('@media (max-width: 640px)'));

  assert.match(mobileRules, /\[data-design="current"\] \.topbar\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) 44px/);
  assert.match(mobileRules, /\[data-design="current"\] \.month-picker\s*\{[^}]*display:\s*contents/);
  assert.match(mobileRules, /\[data-design="current"\] \.design-toggle\s*\{[^}]*width:\s*44px/);
});

test("v2 stat cards can fit two columns at 390px", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const start = css.indexOf('@media (max-width: 860px)');
  const end = css.indexOf('@media (prefers-reduced-motion: reduce)', start);
  const mobileRules = css.slice(start, end);

  assert.match(mobileRules, /\.app\[data-design="v2"\] \.cards\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
});

test("v2 stat cards stack at 380px", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const twoColumn = css.indexOf('.app[data-design="v2"] .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }');
  const start = css.lastIndexOf('@media (max-width: 380px)');
  const narrowRules = css.slice(start);

  assert.isAbove(start, twoColumn);
  assert.match(narrowRules, /\.app\[data-design="v2"\] \.cards\s*\{[^}]*grid-template-columns:\s*1fr/);
});
