/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  resolve: {
    alias: {
      // Мокаем NotificationProvider глобально
      "@/notifications/NotificationProvider": path.resolve(
        __dirname,
        "src/__mocks__/NotificationProvider.tsx"
      ),
      "src/notifications/NotificationProvider": path.resolve(
        __dirname,
        "src/__mocks__/NotificationProvider.tsx"
      ),
      "../notifications/NotificationProvider": path.resolve(
        __dirname,
        "src/__mocks__/NotificationProvider.tsx"
      ),

      // Alias @
      "@": path.resolve(__dirname, "src"),
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
      ],
    },
  },
});
