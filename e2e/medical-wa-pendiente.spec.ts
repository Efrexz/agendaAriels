import { test, expect } from "./fixtures";

// M1 honestidad: la API puede registrar la cita pero FALLAR el WhatsApp
// (Evolution 502). El wizard devuelve whatsappDelivered:false → la pantalla
// final debe ser ÁMBAR con el código, jamás verde prometiendo el recibo.
test("cita con WhatsApp no entregado → aviso ámbar y código, no verde", async ({ page }) => {
  await page.route("**/api/availability", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, closures: [] }) }));
  await page.route("**/api/medical/availability?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, slots: [{ startMinute: 540, endMinute: 600, label: "9:00 am" }, { startMinute: 600, endMinute: 660, label: "10:00 am" }] }),
  }));
  await page.route("**/api/medical/doctors?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, doctors: [{ id: "00000000-0000-4000-8000-000000000111", name: "Dr. Lunes", kind: "general", specialty: null }] }),
  }));
  await page.route("**/api/medical/create", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, appointmentCode: "CM-WAFQ1", requested: false, whatsappDelivered: false }),
  }));

  await page.goto("/medical.html");
  await page.getByRole("button", { name: /Sede San Miguel/ }).click();
  await page.getByRole("button", { name: /Ver servicios disponibles/ }).click();
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.getByRole("button", { name: /Dr\. Lunes/ }).click();
  await page.locator("button:not([disabled])", { hasText: /9|10|11/ }).first().click().catch(() => { /* franja ligada al calendario */ });
  // Elegir día de HOY con hora libre (mock siempre responde con slots)
  const hoyKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const btnHoy = page.locator("button:not([disabled])", { hasText: new RegExp(`^${Number(hoyKey.slice(-2))}$`) }).first();
  if (!(await btnHoy.isVisible().catch(() => false))) await page.reload();
  await btnHoy.click();
  await page.getByRole("button", { name: "9:00 am" }).click();
  await page.getByPlaceholder("Ej: Manolo").fill("Mascota QA");
  await page.getByPlaceholder("Ej: Juan Pérez").fill("Dueño QA");
  await page.getByPlaceholder("999 111 222").fill("999111222");
  await page.getByRole("button", { name: /Confirmar cita/ }).click();

  // Código visible SÍ; banner verde del recibo NO; aviso ámbar SÍ.
  await expect(page.getByText("CM-WAFQ1")).toBeVisible();
  await expect(page.getByText(/El aviso por WhatsApp no se pudo enviar/)).toBeVisible();
  await expect(page.getByText(/Ya recibiste el/)).toHaveCount(0);
  await page.screenshot({ path: "test-results/medical-wa-pendiente.png", fullPage: true });
});
