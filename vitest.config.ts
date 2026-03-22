import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["apps/**/src/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],
  },
});
