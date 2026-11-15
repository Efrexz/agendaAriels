// Capturas QA (no commitear): login nuevo, /estado con logo+lupa, badge de sede.
import { chromium } from "playwright";

const OUT = "/tmp/opencode/qa-screens";
const browser = await chromium.launch();
const page = await browser.newPage();

// 1. Login nuevo — desktop 2 columnas
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:5173/internal", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/login-desktop.png` });

// 2. Login — móvil
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/login-mobile.png` });

// 3. /estado — logo real + botón lupa (desktop y móvil)
//    OJO dev: la página vive en /status.html (producción reescribe /estado).
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:5173/status.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/estado-desktop.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/estado-mobile.png` });

// 4. Wizard grooming — badge de sede azul tras elegir sede en la bienvenida
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
// limpiar localStorage para ver la intro como cliente nuevo
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
// avanzar la intro si existe el botón principal
const next = page.locator("button:has-text('Comenzar'), button:has-text('Empezar'), button:has-text('Continuar')").first();
if (await next.isVisible().catch(() => false)) {
  await next.click();
  await page.waitForTimeout(800);
}
// elegir la primera sede disponible
const sede = page.locator("button:has-text('San Martín'), button:has-text('San Miguel'), button:has-text('Los Olivos')").first();
if (await sede.isVisible().catch(() => false)) {
  await sede.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/wizard-badge.png` });
} else {
  await page.screenshot({ path: `${OUT}/wizard-badge-no-sede.png` });
}

await browser.close();
console.log("capturas en", OUT);
