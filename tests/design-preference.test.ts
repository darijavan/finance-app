import { describe, expect, it } from "vitest";
import { BETA_DESIGN_KEY, readBetaDesign, writeBetaDesign } from "../lib/design-preference.ts";

describe("beta design preference", () => {
  it("is opt-in and persists both selections", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readBetaDesign(storage)).toBe(false);
    writeBetaDesign(storage, true);
    expect(values.get(BETA_DESIGN_KEY)).toBe("enabled");
    expect(readBetaDesign(storage)).toBe(true);
    writeBetaDesign(storage, false);
    expect(readBetaDesign(storage)).toBe(false);
  });
});
