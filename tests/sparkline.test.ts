import { describe, expect, it } from "vitest";
import { sparklinePoints } from "../lib/sparkline.ts";

describe("sparkline point layout", () => {
  it("insets extrema by pad so markers/strokes don't clip the viewBox", () => {
    const pts = sparklinePoints([10, 20, 5, 30], 540, 100, 6);

    expect(pts[0].x).toBe(6);
    expect(pts[pts.length - 1].x).toBe(534);
    expect(Math.min(...pts.map((p) => p.y))).toBeGreaterThanOrEqual(6);
    expect(Math.max(...pts.map((p) => p.y))).toBeLessThanOrEqual(94);
  });

  it("returns no points for fewer than two values", () => {
    expect(sparklinePoints([5], 540, 100, 6)).toEqual([]);
    expect(sparklinePoints([], 540, 100, 6)).toEqual([]);
  });
});
