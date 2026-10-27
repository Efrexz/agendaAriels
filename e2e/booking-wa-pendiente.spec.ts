// QA visual: 200 suave (BD-OK + WhatsApp sin entregar) — banner ámbar en el
// paso de confirmación (nada de error rojo ni reintentos).
import { test, expect, type Route } from "@playwright/test";

test.describe("Booking con WhatsApp no entregado", () => {
  test("confirmación ámbar con el código (sin duplicar reintentos)", async ({ page }) => {
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
    const noon = page.getByRole("button", { name: /Turno mediodía/ });
    const morning = page.getByRole("button", { name: /Turno mañana/ });
    if (await noon.isEnabled()) await noon.click(); else await morning.click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: /Confirmar Reserva/ }).click();

    // Título ámbar + banner del aviso pendiente + código
    await expect(page.getByText(/¡Reserva registrada!/)).toBeVisible();
    await expect(page.getByText(/No pudimos entregar el aviso por WhatsApp/)).toBeVisible();
    await expect(page.getByText(/VA-[A-Z0-9]{5}/)).toBeVisible();
    // NO debe existir pantalla de error ni botón Reintentar
    expect(await page.getByText(/No se pudo enviar la solicitud/).count()).toBe(0);
    expect(await page.getByRole("button", { name: /Reintentar|Llámanos/ }).count()).toBe(0);
    await page.screenshot({ path: "/tmp/opencode/screens/booking-suave-dk.png", fullPage: true });
  });
});
