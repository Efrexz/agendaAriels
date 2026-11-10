// QA visual modales panel interno (/internal) con login stub de Supabase
// (seed del token en localStorage) + APIs interceptadas. Dev en 5173.
// Captura: cita manual, reagendar (base), lab nueva orden, dirty-confirm.
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const REF = "hflqbiqcpkpdczcvakyy";
const DOCTORS = [
  { id: "d1", name: "Dr. Andrés Pérez", kind: "general", branch: "san_martin", active: true },
  { id: "d2", name: "Dra. Uchiyama", kind: "especialista", branch: "san_miguel", active: true, specialtyName: "Cardiología" },
];
const SPECIALTIES = [{ id: "sp1", name: "Odontología", cost: 250, branches: ["san_martin"], active: true }];

async function api(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (d, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(d) });
  if (p.startsWith("/api/")) {
    // Datos amables para cualquier lectura del panel; escrituras responden ok.
    return json({ ok: true, bookings: [], appts: [], orders: [], schedules: [], doctors: DOCTORS, specialties: SPECIALTIES, config: { appt_duration_minutes: "60", payment_info: "Yape / Plin 999 000 000" }, closures: [], labs: [], exams: [], results: [] });
  }
  if (p.includes("/auth/v1/")) {
    // Nunca salimos: cualquier auth por red responde un stub válido
    if (p.includes("/token")) return json({ access_token: "qa-token", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, refresh_token: "qa", user: { id: "qa-user", email: "vet_ariel@hotmail.com", aud: "authenticated", role: "authenticated", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" } });
    return json({ user: null });
  }
  return route.continue();
}

const browser = await chromium.launch();

async function panelSession(scale) {
  const ctx = await browser.newContext({ viewport: scale === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, deviceScaleFactor: scale === "mobile" ? 2 : 1.5 });
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
    const session = { access_token: "qa-token", token_type: "bearer", expires_in: 36000, expires_at: now + 36000, refresh_token: "qa-refresh", user };
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session));
  }, REF);
  await page.goto(`${BASE}/internal`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

// ── Consultas: cita manual ──
{
  const { ctx, page } = await panelSession("desktop");
  await page.getByRole("button", { name: /Consultas/ }).click();
  await page.waitForTimeout(1000);
  const openManual = page.getByRole("button", { name: /Nueva consulta|Cita manual|＋|Nueva cita/ }).first();
  const anyBtn = await openManual.count();
  if (anyBtn > 0) {
    await openManual.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: "/tmp/opencode/int-cita-manual.png", fullPage: false });
    console.log("OK cita manual");
  } else {
    await page.screenshot({ path: "/tmp/opencode/int-consultas-tab.png", fullPage: false });
    console.log("boton manual no encontrado — captura de la tab para diagnosticar");
  }
  await ctx.close();
}

// ── Laboratorio: nueva orden (+ dirty confirm) ──
{
  const { ctx, page } = await panelSession("desktop");
  await page.getByRole("button", { name: /Laboratorio/ }).click();
  await page.waitForTimeout(1000);
  const openLab = page.getByRole("button", { name: /Nueva orden|Nueva muestra|＋/ }).first();
  const anyBtn = await openLab.count();
  if (anyBtn > 0) {
    await openLab.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: "/tmp/opencode/int-lab-orden.png", fullPage: false });
    // dirty confirm: escribir en un campo + Esc
    const petInput = page.getByPlaceholder("Nombre de la mascota").first();
    await petInput.click();
    await page.keyboard.type("Rocco");
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/tmp/opencode/int-dirty-confirm.png", fullPage: false });
    console.log("OK lab orden + dirty");
  } else {
    await page.screenshot({ path: "/tmp/opencode/int-lab-tab.png", fullPage: false });
    console.log("boton lab no encontrado — captura de la tab para diagnosticar");
  }
  await ctx.close();
}

// ── Móvil: cita manual ──
// ── Config: campos con foco de marca ──
{
  const { ctx, page } = await panelSession("desktop");
  await page.getByRole("button", { name: /Config/ }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/opencode/int-config.png", fullPage: true });
  console.log("OK config");
  await ctx.close();
}

// ── Móvil: cita manual ──
{
  const { ctx, page } = await panelSession("mobile");
  await page.getByRole("button", { name: /Consultas/ }).click();
  await page.waitForTimeout(1000);
  const openManual = page.getByRole("button", { name: /Nueva consulta|Cita manual|＋|Nueva cita/ }).first();
  if ((await openManual.count()) > 0) {
    await openManual.click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: "/tmp/opencode/int-cita-manual-movil.png", fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log("Hecho");
