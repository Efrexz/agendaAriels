import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";

// api/ usa imports con extensión .js (requerido por el runtime ESM de Vercel).
// Este plugin deja que Vite/Vitest resuelvan "./db.js" al fuente ./db.ts.
function jsToTsResolver(): Plugin {
  return {
    name: "js-to-ts-resolver",
    resolveId(source, importer) {
      if (source.endsWith(".js") && importer) {
        const candidate = resolve(dirname(importer), source.slice(0, -3) + ".ts");
        if (existsSync(candidate)) return candidate;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), jsToTsResolver()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        internal: resolve(__dirname, "internal.html"),
        status: resolve(__dirname, "status.html"),
        medical: resolve(__dirname, "medical.html"),
      },
    },
  },
});