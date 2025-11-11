import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/client-frontend-backend-generator/",
  server: {
    host: "localhost",
    port: 5173,
    proxy: {
      "/api": {
        target: "https://server-frontend-backend-generator.vercel.app",
        changeOrigin: true,
        secure: false,
      },
    },
    hmr: {
      port: 5173,
      host: "localhost",
    },
    watch: {
      usePolling: true,
    },
  },
});
