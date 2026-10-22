import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The dev server proxies /api to the backend so the two run on one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: process.env.API_ORIGIN || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
