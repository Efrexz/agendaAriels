import type { Page } from "@playwright/test";
import { test, expect, elegirFranjaDisponible } from "./fixtures";

async function irAlResumen(page: Page) {
  await page.goto("/?demo=1");
  await page.getByRole("button", { name: /Agendar con 3 mascotas/ }).click();
  await page.locator(".grid.grid-cols-7").locator("button:not([disabled])").last().click();
  await elegirFranjaDisponible(page);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByLabel(/He leído y acepto/).check();
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/availability", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, closures: [] }),
  }));
});

test("reintento tras perder la respuesta conserva la misma solicitud y código", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/booking", async (route) => {
    const body = route.request().postData() ?? "";
    requests.push(body);
    if (requests.length === 1) return route.abort("failed");
    const { bookingCode } = JSON.parse(body) as { bookingCode: string };
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, bookingCode, bookingStored: true, whatsappDelivered: false }),
    });
  });

  await irAlResumen(page);
  await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
  await expect(page.getByText(/No pudimos confirmar el resultado/)).toBeVisible();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
  await expect(page.getByText(/¡Reserva registrada!/)).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  const { bookingCode } = JSON.parse(requests[0]) as { bookingCode: string };
  await expect(page.getByText(bookingCode, { exact: true })).toBeVisible();
});

test("si solo llegó por WhatsApp, no ofrece un seguimiento que no existe", async ({ page }, testInfo) => {
  await page.route("**/api/booking", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, bookingCode: "VA-WA123", bookingStored: false, whatsappDelivered: true }),
  }));
  await irAlResumen(page);
  await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
  await expect(page.getByText("VA-WA123")).toBeVisible();
  await expect(page.getByText(/el seguimiento en línea no está disponible/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Seguir a tu mascota/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("solo-whatsapp-escritorio.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("solo-whatsapp-movil.png"), fullPage: true });
});

test("una colisión de código permite reintentar con uno nuevo", async ({ page }) => {
  const codes: string[] = [];
  await page.route("**/api/booking", (route) => {
    const { bookingCode } = route.request().postDataJSON() as { bookingCode: string };
    codes.push(bookingCode);
    if (codes.length === 1) return route.fulfill({
      status: 409, contentType: "application/json",
      body: JSON.stringify({ ok: false, codeConflict: true, error: "El código ya está en uso. Vuelve a intentar la reserva." }),
    });
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, bookingCode, bookingStored: true }),
    });
  });
  await irAlResumen(page);
  await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
  await expect(page.getByText(/El código ya está en uso/)).toBeVisible();
  await page.getByRole("button", { name: "Reintentar" }).click();
  await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
  await expect(page.getByText(/¡Solicitud enviada con éxito!/)).toBeVisible();
  expect(codes).toHaveLength(2);
  expect(codes[1]).not.toBe(codes[0]);
  await expect(page.getByText(codes[1], { exact: true })).toBeVisible();
});
