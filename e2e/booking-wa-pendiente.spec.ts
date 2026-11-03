// QA visual: 200 suave (BD-OK + WhatsApp sin entregar) — banner ámbar en el
// paso de confirmación (nada de error rojo ni reintentos).
import type { Route } from "@playwright/test";
import { test, expect, elegirFranjaDisponible } from "./fixtures";

test.describe("Booking con WhatsApp no entregado", () => {
  test("confirmación ámbar con el código (sin duplicar reintentos)", async ({ page }, testInfo) => {
    await page.route("**/api/booking", (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, bookingCode: "VA-QA123", whatsappDelivered: false }),
      }));
    await page.route("**/webhook/**", (route: Route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));

    await page.goto("/?demo=1");
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();
    await page.getByRole("button", { name: /Agendar con 3 mascotas/ }).click();
    const dayButtons = page.locator(".grid.grid-cols-7").locator("button:not([disabled])");
    await dayButtons.last().click();
    await elegirFranjaDisponible(page);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: /Confirmar Reserva/ }).click();

    // Título ámbar + banner del aviso pendiente + código
    await expect(page.getByText(/¡Reserva registrada!/)).toBeVisible();
    await expect(page.getByText(/No pudimos entregar el aviso por WhatsApp/)).toBeVisible();
    await expect(page.getByText("VA-QA123")).toBeVisible();
    await expect(page.getByRole("link", { name: /Seguir a tu mascota/ })).toHaveAttribute("href", "/estado?code=VA-QA123");
    // NO debe existir pantalla de error ni botón Reintentar
    expect(await page.getByText(/No se pudo enviar la solicitud/).count()).toBe(0);
    expect(await page.getByRole("button", { name: /Reintentar|Llámanos/ }).count()).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("booking-suave-dk.png"), fullPage: true });
  });
});
