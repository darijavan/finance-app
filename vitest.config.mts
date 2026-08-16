import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["lib/**/*.{ts,tsx}", "app/api/**/*.ts", "app/(finance)/**/*.tsx"],
      exclude: ["lib/types.ts"],
    },
  },
  resolve: { alias: { "@": new URL("./", import.meta.url).pathname } },
});