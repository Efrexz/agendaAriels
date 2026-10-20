import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        internal: resolve(__dirname, "internal.html"),
        status: resolve(__dirname, "status.html"),
      },
    },
  },
});