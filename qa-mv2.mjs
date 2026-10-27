import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 1100 } });
await ctx.route(/\/api\/medical\/(doctors|availability)/, r =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    ok: true, doctors: [{ id: "d1", name: "Dra. Karla Ramírez", kind: "general", specialty: null }],
    slots: [{ startMinute: 600, label: "10:00 am" }] }) }));
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", e => errs.push(e.message.slice(0, 120)));
await page.goto("http://localhost:5173/medical.html", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1300);
await page.locator("button", { hasText: "Seleccionar sede" }).first().click();
await page.locator("button", { hasText: "Ver servicios disponibles" }).click();
await page.waitForTimeout(1200);
await page.locator("button", { hasText: "Consulta General" }).click();
await page.waitForTimeout(1300);
console.log("flujo OK:", (await page.locator("button", { hasText: "Dra. Karla" }).count()) === 1, "pageerrors:", errs.length);
await browser.close();
