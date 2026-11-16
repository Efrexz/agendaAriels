// Capturas del nuevo paso "subir_orden" (rayos/eco con orden, feedback 16/11).
import { chromium } from "playwright";

const OUT = "/tmp/opencode/qa-screens";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5173/medical.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// sede → continuar
const sede = page.locator("button:has-text('San Martín'), button:has-text('San Miguel'), button:has-text('Los Olivos')").first();
await sede.click();
await page.waitForTimeout(500);
const continuar = page.locator("button:has-text('Continuar')").first();
if (await continuar.isVisible().catch(() => false)) { await continuar.click(); await page.waitForTimeout(600); }

// servicio → rayos
await page.locator("button:has-text('Radiografía')").first().click();
await page.waitForTimeout(700);

// orden → "Sí, tengo orden" → paso subir_orden
await page.locator("button:has-text('Sí, tengo orden')").first().click();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${OUT}/subir-orden.png` });
await browser.close();
console.log("captura en", OUT);
