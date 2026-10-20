import { describe, expect, it } from "vitest";
import { tagTextColor } from "../lib/tag-color";

describe("tagTextColor", () => {
  it("uses white text on a dark background", () => {
    expect(tagTextColor("#123456")).toBe("#fff");
  });

  it("uses black text when it produces the stronger WCAG contrast", () => {
    expect(tagTextColor("#ffcc00")).toBe("#000");
    expect(tagTextColor("#aba3dc")).toBe("#000");
  });
});
