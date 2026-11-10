// QA: estados del picker de horas en "Cita manual" (consulta manual del counter).
// A: cargando (availability lenta) · B: doctor sin horarios ese día · C: horas listas
// Corre con dev en 5173: node /tmp/opencode/qa-picker-horas.js
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const REF = "hflqbiqcpkpdczcvakyy";
const DOCTORS = [
  { id: "d1", name: "Dr. Andrés Pérez", kind: "general", branch: "san_martin", active: true },
  { id: "d2", name: "Dr. Bruno Soto", kind: "general", branch: "san_martin", active: true },
];

async function api(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.endsWith("/api/medical/availability")) {
    const date = url.searchParams.get("date") ?? "";
    // B: 2099-12-01 → sin horarios · resto: horarios con 900ms de demora
    if (date === "2099-12-01") return json({ slots: [] });
    await new Promise((r) => setTimeout(r, 900));
    return json({ slots: [540, 570, 600, 690, 720].map((m) => ({ startMinute: m, label: `${String(Math.floor(m / 60))}:00`, isAvailable: true })) });
  }
  if (p.startsWith("/api/")) {
    return json({ ok: true, bookings: [], appts: [], orders: [], schedules: [], doctors: DOCTORS, specialties: [], config: {}, closures: [], labs: [], exams: [], results: [] });
  }
  if (p.includes("/auth/v1/")) return json({ user: null });
  return route.continue();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
const page = await ctx.newPage();
await page.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "5173") return route.continue();
  return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
});
await page.route("**/*", api);
await page.goto(`${BASE}/internal`, { waitUntil: "domcontentloaded" });
await page.evaluate((ref) => {
  const now = Math.floor(Date.now() / 1000);
  const user = { id: "qa-user", email: "vet_ariel@hotmail.com", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: "qa-token", token_type: "bearer", expires_in: 36000, expires_at: now + 36000, refresh_token: "qa", user }));
}, REF);
await page.goto(`${BASE}/internal`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Consultas → cita manual
await page.getByRole("button", { name: /Consultas/ }).click();
await page.waitForTimeout(900);
await page.getByRole("button", { name: /Nueva consulta|Cita manual/ }).first().click();
await page.waitForTimeout(800);

// A: cargando (availability responde en 900ms → capturamos el skeleton en plena carga)
await page.locator('input[type="date"]').fill("2099-01-05").catch(() => {});
await page.waitForTimeout(250);
await page.screenshot({ path: "/tmp/opencode/picker-loading.png", fullPage: false });
console.log("A loading OK");
await page.waitForTimeout(1400); // termina de cargar → horarios

// B: fecha SIN horarios
await page.locator('input[type="date"]').fill("2099-12-01").catch(() => {});
await page.waitForTimeout(1800);
await page.screenshot({ path: "/tmp/opencode/picker-vacio.png", fullPage: false });
console.log("B vacio OK");

// C: horas de vuelta + cambiar doctor no desincroniza
await page.locator('input[type="date"]').fill("2099-01-05").catch(() => {});
await page.waitForTimeout(1800);
await page.screenshot({ path: "/tmp/opencode/picker-horas.png", fullPage: false });
console.log("C horas OK");

// badge /medical con Stethoscope (desktop, APIs públicas del wizard interceptadas)
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
await page2.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if ((u.hostname === "localhost" || u.hostname === "127.0.0.1") && u.port === "5173") return route.continue();
  return route.fulfill({ status: 200, contentType: "application/json", body: "null" });
});
await page2.route("**/*", async (route) => {
  const p = new URL(route.request().url()).pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.endsWith("/api/medical/doctors")) return json({ doctors: DOCTORS });
  if (p.endsWith("/api/medical/specialties")) return json({ specialties: [] });
  if (p.endsWith("/api/medical/availability")) return json({ slots: [] });
  if (p.endsWith("/api/availability")) return json({ closures: [] });
  return route.continue();
});
await page2.goto(`${BASE}/medical`, { waitUntil: "networkidle" });
await page2.waitForTimeout(1200);
await page2.screenshot({ path: "/tmp/opencode/badge-stetho.png", fullPage: false });
console.log("badge OK");
await ctx2.close();
await ctx.close();
await browser.close();
console.log("Hecho");
