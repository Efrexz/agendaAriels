// Genera public/og-image.png (1200x630) a partir de scripts/og-image.html
// usando el Chromium de Playwright ya instalado. Ejecutar: node scripts/generate-og.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto("file://" + path.join(root, "og-image.html"));
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(root, "..", "public", "og-image.png") });
await browser.close();
console.log("og-image.png generado en public/og-image.png");
