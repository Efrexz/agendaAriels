// QA visual: systema de confirmacion unificado (grooming + citas) + tarjetas ilustradas.
// Estados:
//   [medical] sin_orden / agenda (tarjeta ilustrada) + enviado especializada 2 col
//   [grooming] exito WA no entregado (maqueta) + exito WA entregado
// Correr con dev en 5173: node /tmp/opencode/qa-confirmaciones.js
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const DOCTORS = [{ id: "d1", name: "Dr. Andrés Pérez", kind: "general", specialty: null }];
const SPECIALTIES = [
  { id: "sp1", name: "Odontología", cost: 250 },
  { id: "sp2", name: "Nutrición", cost: 220 },
];

async function medApi(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
  if (p.endsWith("/api/medical/specialties")) return json({ specialties: SPECIALTIES });
  if (p.endsWith("/api/medical/availability")) return json({ slots: [540, 570, 690].map((m) => ({ startMinute: m, isAvailable: true })) });
  if (p.endsWith("/api/availability")) return json({ closures: [] });
  if (p.endsWith("/api/medical/create")) return json({ appointmentCode: "CM-QA42", whatsappDelivered: false });
  return route.continue();
}

async function groomApi(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.endsWith("/api/availability")) return json({ ok: true, closures: [] });
  return route.continue();
}

const VIEW = (scale) => (scale === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1100 });
const DSF = (scale) => (scale === "mobile" ? 2 : 1.5);

async function med(page) {
  return page;
}

// ─── Citas médicas: sin_orden + agenda (tarjetas ilustradas) ───
async function shotsMedicalMascotas(browser, scale) {
  const ctx = await browser.newContext({ viewport: VIEW(scale), deviceScaleFactor: DSF(scale) });
  const page = await ctx.newPage();
  await page.route("**/api/**", medApi);
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Martín de Porres/ }).click();
  await page.waitForTimeout(250);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Radiografía/ }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "No tengo" }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `/tmp/opencode/card-sinorden-${scale}.png`, fullPage: true });
  // Agenda
  await page.getByRole("button", { name: "Volver atrás" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.waitForTimeout(700);
  await page.locator('button:has-text("Dr. Andrés Pérez")').first().click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `/tmp/opencode/card-agenda-${scale}.png`, fullPage: true });
  console.log("mascotas OK:", scale);
  await ctx.close();
}

// ─── Citas médicas: enviado ESPECIALIZADA (interconsulta) 2 columnas ───
async function shotsMedicalEnviado(browser, scale) {
  const ctx = await browser.newContext({ viewport: VIEW(scale), deviceScaleFactor: DSF(scale) });
  const page = await ctx.newPage();
  await page.route("**/api/**", medApi);
  await page.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Sede San Martín de Porres/ }).click();
  await page.waitForTimeout(250);
  await page.locator("button.bg-gradient-to-r").click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Consulta Especializada/ }).click();
  await page.waitForTimeout(700);
  await page.locator('button:has-text("Odontología")').first().click();
  await page.waitForTimeout(700);
  await page.getByPlaceholder("Ej: Manolo").fill("Rocco");
  await page.getByPlaceholder("Ej: Juan Pérez").fill("Juana Mendoza");
  await page.getByPlaceholder("999 111 222").fill("999111222");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Confirmar cita/ }).click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `/tmp/opencode/enviado-esp-${scale}.png`, fullPage: true });
  console.log("enviado esp OK:", scale);
  await ctx.close();
}

// ─── Grooming: éxito (2 estados de WhatsApp) ───
async function shotsGrooming(browser, scale, delivered, tag) {
  const ctx = await browser.newContext({ viewport: VIEW(scale), deviceScaleFactor: DSF(scale) });
  const page = await ctx.newPage();
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/api/booking")) {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, bookingCode: "VA-QA777", bookingStored: true, whatsappDelivered: delivered }),
      });
    }
    if (url.pathname.endsWith("/api/availability")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, closures: [] }) });
    }
    return route.continue();
  });
  await page.goto(`${BASE}/?demo=1`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Agendar con 3 mascotas/ }).click();
  await page.locator(".grid.grid-cols-7").locator("button:not([disabled])").last().click();
  await page.waitForTimeout(600);
  const noon = page.getByRole("button", { name: /Turno mediodía/ });
  const morning = page.getByRole("button", { name: /Turno mañana/ });
  if (await noon.isEnabled()) await noon.click(); else await morning.click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByLabel(/He leído y acepto/).check();
  await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `/tmp/opencode/grooming-${tag}-${scale}.png`, fullPage: true });
  console.log("grooming OK:", tag, scale);
  await ctx.close();
}

const browser = await chromium.launch();
// Médicas
await shotsMedicalMascotas(browser, "desktop");
await shotsMedicalMascotas(browser, "mobile");
await shotsMedicalEnviado(browser, "desktop");
await shotsMedicalEnviado(browser, "mobile");
// Grooming
await shotsGrooming(browser, "desktop", false, "warning");
await shotsGrooming(browser, "desktop", true, "ok");
await shotsGrooming(browser, "mobile", false, "warning");
await browser.close();
console.log("Hecho");
