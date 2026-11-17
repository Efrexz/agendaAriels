// HOTFIX 18/11: verificar que el Resumen muestre "Consulta General" (antes
// quedaba vacío por serviceType null en el refactor de tiles).
import { chromium } from "playwright";

const OUT = "/tmp/opencode/qa-screens";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Mocks mínimos (dev no sirve APIs): catch-all PRIMERO (Playwright usa el
// último registrado → los específicos van después para pisarlo)
await page.route("**/api/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, doctors: [], specialties: [], slots: [] }) }));
await page.route("**/api/medical/doctors*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ doctors: [{ id: "d1", name: "Dr. Adrián Nolasco", kind: "general", branch: "san_martin", active: true, specialty: null }] }) }));
await page.route("**/api/medical/availability*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ slots: [540, 600, 720].map((m) => ({ startMinute: m, label: `${Math.floor(m / 60)}:00`, isAvailable: true })) }) }));
await page.route("**/api/medical/prices*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rayos: "120", eco: "150" }) }));
await page.route("**/api/medical/create*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, appointmentCode: "CM-QATEST", requested: false, whatsappDelivered: true }) }));

await page.goto("http://localhost:5173/medical.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// sede → servicios → Consulta General
await page.locator("button:has-text('Seleccionar sede')").first().click();
await page.waitForTimeout(400);
await page.locator("button:has-text('Ver servicios disponibles')").first().click();
await page.waitForTimeout(800);
await page.locator("button:has-text('Consulta General')").first().click();
await page.waitForTimeout(900);

// doctor → agenda → hora → datos (Resumen)
const doctor = page.locator("button:has-text('Dr')").first();
await doctor.click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/hotfix-doctor.png` });

// agenda: elegir un día habilitado + una hora → pasa SOLO a datos (sin botón)
const dias = page.locator("button:not([disabled])").filter({ hasText: /^[0-9]{1,2}$/ });
await dias.last().click();
await page.waitForTimeout(900);
// hora: primer chip de horario disponible → navega directo a datos
const hora = page.locator("button:not([disabled])").filter({ hasText: /am|pm/ }).first();
if (await hora.isVisible().catch(() => false)) {
  await hora.click();
  await page.waitForTimeout(900);
}

// datos: llenar el mínimo para ver el Resumen
await page.locator("input[placeholder='Ej: Manolo']").first().fill("Firulais");
await page.locator("input[placeholder='Ej: Juan Pérez']").first().fill("Abigail Rodríguez");
const tel = page.locator("input[type='tel']").first();
await tel.fill("986859047");
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/hotfix-datos-resumen.png` });

const body = await page.locator("body").innerText();
console.log("Servicio en Resumen:", /Consulta General/.test(body) ? "✓ visible" : "✗ VACÍO");
await browser.close();
