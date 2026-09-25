import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: `npm run dev` at the repo root runs this (127.0.0.1:5173) together with the
// Python API (`parhelion ui --no-browser --reload` on 127.0.0.1:8765), proxied below.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:8765",
      "/files": "http://127.0.0.1:8765",
    },
  },
  // Local single-user app: one bundle is fine.
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
});
