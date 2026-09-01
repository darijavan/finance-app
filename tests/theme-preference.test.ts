import { describe, expect, it } from "vitest";
import { V2_THEME_KEY, readV2Theme, writeV2Theme } from "../lib/theme-preference.ts";

describe("v2 theme preference", () => {
  it("has no stored preference until one is written", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(readV2Theme(storage)).toBeNull();
    writeV2Theme(storage, "dark");
    expect(values.get(V2_THEME_KEY)).toBe("dark");
    expect(readV2Theme(storage)).toBe("dark");
    writeV2Theme(storage, "light");
    expect(readV2Theme(storage)).toBe("light");
  });

  it("ignores unrecognized stored values", () => {
    const storage = { getItem: () => "system", setItem: () => {} };

    expect(readV2Theme(storage)).toBeNull();
  });
});
