import { defineConfig } from "vitest/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// Config de vitest aparte: los specs de `e2e/` pertenecen a Playwright
// (`npm run test:e2e`) y no deben ejecutarse en `npm run test`.
export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    exclude: ["node_modules/**", "e2e/**"],
  },
});
