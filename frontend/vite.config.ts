// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://api.local",
        changeOrigin: true,
        secure: false,
        // secure: true, если у api.local нормальный TLS-сертификат
      },
    },
  },
});
