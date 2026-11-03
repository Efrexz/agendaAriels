import { test, expect } from "./fixtures";

test("un horario ocupado al confirmar permite elegir otro sin perder los datos", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/availability", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, closures: [] }),
  }));
  await page.route("**/api/medical/doctors?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, doctors: [{ id: "5eb9cf5e-9e46-4a2c-8a7b-000000000002", name: "Doctor Prueba", kind: "general", specialty: null }] }),
  }));
  await page.route("**/api/medical/availability?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, slots: attempts === 0
      ? [{ startMinute: 540, endMinute: 600, label: "09:00" }, { startMinute: 600, endMinute: 660, label: "10:00" }]
      : [{ startMinute: 600, endMinute: 660, label: "10:00" }] }),
  }));
  await page.route("**/api/medical/create", (route) => {
    attempts++;
    if (attempts === 1) return route.fulfill({
      status: 409, contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Ese horario ya no está disponible. Elige otro." }),
    });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, appointmentCode: "CM-TEST2" }) });
  });

  await page.goto("/medical.html");
  await page.getByRole("button", { name: /Sede San Miguel/ }).click();
  await page.getByRole("button", { name: /Ver servicios disponibles/ }).click();
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.getByRole("button", { name: /Doctor Prueba/ }).click();
  await page.locator(".grid.grid-cols-7").locator("button:not([disabled])").last().click();
  await page.getByRole("button", { name: "9:00 am" }).click();
  await page.getByPlaceholder("Ej: Manolo").fill("Mascota Prueba");
  await page.getByPlaceholder("Ej: Juan Pérez").fill("Cliente Prueba");
  await page.getByPlaceholder("999 111 222").fill("999111222");
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page.getByText("Ese horario ya no está disponible. Elige otro.")).toBeVisible();
  await page.getByRole("button", { name: "Volver atrás" }).click();
  await page.getByRole("button", { name: "10:00 am" }).click();
  await expect(page.getByPlaceholder("Ej: Manolo")).toHaveValue("Mascota Prueba");
  await expect(page.getByPlaceholder("Ej: Juan Pérez")).toHaveValue("Cliente Prueba");
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await expect(page.getByText("CM-TEST2")).toBeVisible();
  expect(attempts).toBe(2);
});
