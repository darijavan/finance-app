import { describe, expect, it } from "vitest";
import { checkEmptyLines } from "../scripts/check-empty-lines.mjs";

describe("successive empty line checks", () => {
  it("detects and safely fixes multiple empty lines", () => {
    const source = "const first = 1;\n\n\nconst second = 2;\n";
    const fixed = checkEmptyLines("example.ts", source, true);

    expect(fixed.warnings).toEqual([3]);
    expect(fixed.text).toBe("const first = 1;\n\nconst second = 2;\n");
    expect(checkEmptyLines("example.ts", fixed.text, true)).toEqual({ text: fixed.text, warnings: [] });
  });

  it("preserves Unicode separators inside strings", () => {
    const source = 'const value = "first\u2028middle\u2029last";\n';

    expect(checkEmptyLines("example.ts", source, true)).toEqual({ text: source, warnings: [] });
  });

  it("preserves CRLF line endings", () => {
    const source = "const first = 1;\r\n\r\n\r\nconst second = 2;\r\n";

    expect(checkEmptyLines("example.ts", source, true).text).toBe("const first = 1;\r\n\r\nconst second = 2;\r\n");
  });

  it("preserves multiline template and JSX text, including interpolation", () => {
    const source =
      'const string = "first\\\n\\\n\\\nlast";\nconst value = `first\n\n\n${name}\n\n\nlast`;\nconst view = <div>first\n\n\n{name}\n\n\nlast</div>;\n';

    expect(checkEmptyLines("example.tsx", source, true)).toEqual({ text: source, warnings: [] });
  });
});
