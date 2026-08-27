import { describe, expect, it } from "vitest";
import { tagTextColor } from "../lib/tag-color";

describe("tagTextColor", () => {
  it("uses white text on a dark background", () => {
    expect(tagTextColor("#123456")).toBe("#fff");
  });

  it("uses black text on a light background", () => {
    expect(tagTextColor("#ffcc00")).toBe("#000");
  });
});
