import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Прокси /api без rewrite — бэкенд уже слушает /api/*
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://api.local", // либо https://api.local — если у тебя TLS
        changeOrigin: true,
        secure: false,              // true, если сертификат нормальный (не self-signed)
        // rewrite не нужен
      },
    },
  },
  // Vitest: окружение, глобалы и lcov для SonarQube
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],   // lcov нужен для Sonar
      reportsDirectory: "coverage",
    },
  },
});
