import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

// Web / PWA build — no Tauri, fetch-based IPC, outputs to dist-web/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Consumed by App.tsx and any other component that needs to vary by target.
    "import.meta.env.VITE_BUILD_TARGET": JSON.stringify("web"),
  },
  resolve: {
    alias: [
      // Swap the Tauri invoke-based IPC for the fetch-based web implementation.
      {
        find: /^(.*\/lib\/ipc)$/,
        replacement: resolve(__dirname, "src/lib/ipc.web.ts"),
      },
      // Swap the Tauri window API for a no-op stub.
      {
        find: /^(.*\/lib\/windows)$/,
        replacement: resolve(__dirname, "src/lib/windows.web.ts"),
      },
    ],
  },
  build: {
    outDir: "dist-web",
    target: "safari15",
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
    // Proxy /api to the local vault-server during development.
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
