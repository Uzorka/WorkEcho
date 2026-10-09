import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Database permission tests. Need a running Supabase (`npm run db:start`)
// with migrations applied, and .env.local filled in (incl. the service-role key).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 20_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
