import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://api.local", // или https://api.local — как у тебя открыт Swagger
        changeOrigin: true,
        secure: false,              // если https с самоподписанным
        // ВАЖНО: без rewrite! backend уже слушает /api/*
        // rewrite: (p) => p,  // просто НЕ добавляй rewrite
      },
    },
  },
});
