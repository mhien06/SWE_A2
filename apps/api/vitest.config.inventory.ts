import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { globals: true, include: ["test/inventory.postgres-spec.ts"], testTimeout: 15000, hookTimeout: 30000 },
});
