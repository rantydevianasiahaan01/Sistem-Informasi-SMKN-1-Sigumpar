import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proxyTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8001";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      xlsx: path.resolve(__dirname, "src/lib/xlsx.js"),
    },
  },

  server: {
    // PENTING: Izinkan akses dari luar kontainer (Host OS)
    host: "0.0.0.0",
    port: 5173,

    // Konfigurasi Watch agar hot-reload jalan di Docker (Windows/WSL)
    watch: {
      usePolling: true,
    },

    proxy: {
      "/api": {
        // Override dengan nama service Docker jika Vite dijalankan di container.
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
