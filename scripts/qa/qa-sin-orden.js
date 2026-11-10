// QA visual paso "sin_orden" (/medical) — APIs interceptadas, sin backend.
// Captura escritorio + móvil. Ejecutar: node /tmp/opencode/qa-sin-orden.js
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const DOCTORS = [
  { id: "d1", name: "Dr. General Uno", kind: "general" },
  { id: "d2", name: "Dra. General Dos", kind: "general" },
];
const SLOTS = Array.from({ length: 8 }, (_, i) => ({ startMinute: 540 + i * 30, label: "" }));

async function routeApi(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
  if (p.endsWith("/api/medical/specialties")) return json({ specialties: [] });
  if (p.endsWith("/api/medical/availability")) return json({ slots: SLOTS });
  return route.continue();
}

const ctxOpts = (scale) => ({
  viewport: scale === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  deviceScaleFactor: scale === "mobile" ? 2 : 1.5,
});

async function drive(page) {
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  // 1) sede: card "Sede San Martín de Porres" + botón continuar
  await page.getByRole("button", { name: /Sede San Martín de Porres/ }).click();
  await page.waitForTimeout(300);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(500);
  // 2) servicio Radiografía (pide orden sellada)
  await page.getByRole("button", { name: /Radiografía/ }).click();
  await page.waitForTimeout(600);
  // 3) paso orden → "No tengo"
  await page.getByRole("button", { name: "No tengo" }).click();
  await page.waitForTimeout(1500); // animaciones de entrada
}

async function shot(browser, scale, file) {
  const ctx = await browser.newContext(ctxOpts(scale));
  const page = await ctx.newPage();
  await page.route("**/api/**", routeApi);
  await drive(page);
  await page.screenshot({ path: file, fullPage: true });
  console.log("OK ->", file);
  await ctx.close();
}

const browser = await chromium.launch();
await shot(browser, "desktop", "/tmp/opencode/sin-orden-desktop.png");
await shot(browser, "mobile", "/tmp/opencode/sin-orden-movil.png");
await browser.close();
console.log("Hecho");
