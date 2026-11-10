// QA visual paso "agenda" (/medical) — APIs interceptadas, sin backend.
// Estados: (A) sin día elegido → frenchie doctor + panel; (B) día elegido → slot azul + horarios.
// Ejecutar con dev en 5173: node /tmp/opencode/qa-agenda.js
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const DOCTORS = [
  { id: "d1", name: "Dr. Andrés Pérez", kind: "general", specialty: null },
];
const SLOTS = [540, 570, 600, 690, 720, 750, 810, 900].map((m) => ({
  startMinute: m, isAvailable: true,
}));

async function routeApi(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (data) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
  if (p.endsWith("/api/medical/specialties")) return json({ specialties: [] });
  if (p.endsWith("/api/medical/availability")) return json({ slots: SLOTS });
  if (p.endsWith("/api/availability")) return json({ closures: [] });
  return route.continue();
}

const CTX = (scale) => ({
  viewport: scale === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1100 },
  deviceScaleFactor: scale === "mobile" ? 2 : 1.5,
});

async function drive(page) {
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Martín de Porres/ }).click();
  await page.waitForTimeout(300);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.waitForTimeout(800);
  // Doctor: primera card
  await page.locator('button:has-text("Dr. Andrés Pérez")').first().click();
  await page.waitForTimeout(900);
}

async function shot(browser, scale, tag) {
  const ctx = await browser.newContext(CTX(scale));
  const page = await ctx.newPage();
  await page.route("**/api/**", routeApi);
  await drive(page);
  // Estado A: sin día
  await page.screenshot({ path: `/tmp/opencode/agenda-${tag}.png`, fullPage: true });
  console.log("A ->", tag);
  // Estado B: día 8 (domingo de la semana actual → tarjetas de horarios reales)
  const dayBtn = page.locator("button:not([disabled])").filter({ hasText: /^8$/ }).first();
  await dayBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `/tmp/opencode/agenda-con-dia-${tag}.png`, fullPage: true });
  console.log("B ->", tag);
  await ctx.close();
}

const browser = await chromium.launch();
await shot(browser, "desktop", "desktop");
await shot(browser, "mobile", "movil");
await browser.close();
console.log("Hecho");
