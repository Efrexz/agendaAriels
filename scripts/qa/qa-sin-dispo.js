// QA: estado "doctor sin horarios este día" (/medical, paso agenda) con
// availability interceptado VACÍO (maqueta 09/11: sinDisponibilidad.webp milímetro).
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const DOCTORS = [{ id: "d1", name: "Dr. Andrés Pérez", kind: "general", specialty: null }];

async function api(route) {
  const p = new URL(route.request().url()).pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
  if (p.endsWith("/api/medical/specialties")) return json({ specialties: [] });
  if (p.endsWith("/api/medical/availability")) return json({ slots: [] }); // SIEMPRE vacío → estado maqueta
  if (p.endsWith("/api/availability")) return json({ closures: [] });
  return route.continue();
}

const browser = await chromium.launch();
for (const scale of ["desktop", "mobile"]) {
  const ctx = await browser.newContext({
    viewport: scale === "mobile" ? { width: 390, height: 900 } : { width: 1440, height: 1100 },
    deviceScaleFactor: scale === "mobile" ? 2 : 1.5,
  });
  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "5173") return route.continue();
    return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  await page.route("**/*", api);
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Martín de Porres/ }).click();
  await page.waitForTimeout(300);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Dr. Andrés Pérez")').first().click();
  await page.waitForTimeout(1000);
  // elegir un día habilitado (día 8 domingo de la semana actual)
  await page.locator("button:not([disabled])").filter({ hasText: /^10$/ }).first().click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `/tmp/opencode/sin-dispo-${scale}.png`, fullPage: true });
  console.log("OK ->", scale);
  await ctx.close();
}
await browser.close();
console.log("Hecho");
