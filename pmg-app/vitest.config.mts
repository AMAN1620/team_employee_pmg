import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": import.meta.dirname } },
  test: { environment: "node", include: ["tests/**/*.test.ts"], env: { PMG_DB_PATH: ":memory:", PMG_AI: "rules", PMG_SYNC: "off" } },
});
