// QA: éxito de citas reformado (2 estados) + sinDisponibilidad grande sin fundido.
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const DOCTORS = [
  { id: "d1", name: "Dr. Andrés Pérez", kind: "general", specialty: null },
  { id: "d2", name: "Dra. Karla Cepeda", kind: "general", specialty: null },
];

async function okRoute(route) {
  const p = new URL(route.request().url()).pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
  if (p.endsWith("/api/medical/specialties")) return json({ specialties: [] });
  if (p.endsWith("/api/medical/availability")) return json({ slots: [540, 600, 720].map((m) => ({ startMinute: m, label: `${m / 60}:00 pm`, isAvailable: true })) });
  if (p.endsWith("/api/availability")) return json({ closures: [] });
  return route.continue();
}

const browser = await chromium.launch();

// ÉXITO de cita estándar (con warning WA fallido, como la captura del usuario)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.route("**/*", okRoute);
  await page.route("**/api/medical/create", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ appointmentCode: "CM-QA11", whatsappDelivered: false }),
  }));
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Miguel/ }).click();
  await page.waitForTimeout(300);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Dra. Karla Cepeda")').first().click();
  await page.waitForTimeout(900);
  await page.locator("button:not([disabled])").filter({ hasText: /^10$/ }).first().click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "/tmp/opencode/dbg-picker.png", fullPage: true });
  console.log("chips 9pm:", await page.getByRole("button", { name: "9:00 am" }).count(), "| 12pm:", await page.getByRole("button", { name: "12:00 pm" }).count());
  await page.getByRole("button", { name: "9:00 am" }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Ej: Manolo").fill("Rocco");
  await page.getByPlaceholder("Ej: Juan Pérez").fill("Juana Mendoza");
  await page.getByPlaceholder("999 111 222").fill("999111222");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Confirmar cita/ }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "/tmp/opencode/enviado-nuevo-desktop.png", fullPage: true });
  console.log("OK enviado desktop");
  await ctx.close();
}

// ÉXITO móvil
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route("**/*", okRoute);
  await page.route("**/api/medical/create", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ appointmentCode: "CM-QA22", whatsappDelivered: true }),
  }));
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Miguel/ }).click();
  await page.waitForTimeout(300);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Dra. Karla Cepeda")').first().click();
  await page.waitForTimeout(900);
  await page.locator("button:not([disabled])").filter({ hasText: /^10$/ }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "9:00 am" }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder("Ej: Manolo").fill("Rocco");
  await page.getByPlaceholder("Ej: Juan Pérez").fill("Juana Mendoza");
  await page.getByPlaceholder("999 111 222").fill("999111222");
  await page.getByRole("button", { name: /Confirmar cita/ }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "/tmp/opencode/enviado-nuevo-movil.png", fullPage: true });
  console.log("OK enviado movil");
  await ctx.close();
}

// sinDisponibilidad grande sin fundido (desktop)
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  await page.route("**/*", async (route) => {
    const p = new URL(route.request().url()).pathname;
    const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
    if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
    if (p.endsWith("/api/medical/specialties")) return json({ specialties: [] });
    if (p.endsWith("/api/medical/availability")) return json({ slots: [] });
    if (p.endsWith("/api/availability")) return json({ closures: [] });
    return route.continue();
  });
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Martín de Porres/ }).click();
  await page.waitForTimeout(300);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Dr. Andrés Pérez")').first().click();
  await page.waitForTimeout(1000);
  await page.locator("button:not([disabled])").filter({ hasText: /^10$/ }).first().click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: "/tmp/opencode/sin-dispo-grande.png", fullPage: true });
  console.log("OK sin disponibilidad");
  await ctx.close();
}

await browser.close();
console.log("Hecho");
