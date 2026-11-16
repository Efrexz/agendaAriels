// Capturas del navbar nuevo del panel (maqueta 17/11): desktop + móvil.
// Stub de sesión (patrón qa-picker-horas) + APIs mockeadas; sin backend real.
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const OUT = "/tmp/opencode/qa-screens";
const REF = "hflqbiqcpkpdczcvakyy";

async function api(route) {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const json = (d) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(d) });
  if (p.startsWith("/api/")) {
    return json({ ok: true, bookings: [], appts: [], orders: [], schedules: [], doctors: [], specialties: [], config: {}, closures: [], labs: [], exams: [], results: [] });
  }
  if (p.includes("/auth/v1/")) return json({ user: null });
  return route.continue();
}

const browser = await chromium.launch();
for (const vp of [{ width: 1440, height: 900, name: "desktop" }, { width: 390, height: 844, name: "mobile" }]) {
  const ctx = await browser.newContext({ viewport: vp });
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
  await page.waitForTimeout(1200);
  // activar la pestaña Consultas para ver el navbar con pestaña activa real
  await page.getByRole("button", { name: /Consultas/ }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/navbar-${vp.name}.png` });
  await ctx.close();
}
await browser.close();
console.log("capturas en", OUT);
