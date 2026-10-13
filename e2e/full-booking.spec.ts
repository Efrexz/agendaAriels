import { test, expect, type Route } from "@playwright/test";

/**
 * Reserva completa (recurrente) hasta la confirmación, con /api/booking
 * interceptado para no depender del servidor de WhatsApp en dev.
 * Al confirmar, el perfil vuelve a quedar guardado (unión de mascotas).
 */
test.describe("Reserva completa desde la bienvenida", () => {
  test.beforeEach(async ({ page }) => {
    // Se intercepta tanto /api/booking como el webhook directo de desarrollo
    // (si existe VITE_N8N_WEBHOOK_URL, la app le envía directamente).
    const stub = (route: Route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    await page.route("**/api/booking", stub);
    await page.route("**/webhook/**", stub);
    await page.goto("/?demo=1");
  });

  test("agendar 3 mascotas guardadas: fecha → datos → resumen → confirmación", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();

    // 1. Bienvenida → fecha y horario
    await page.getByRole("button", { name: /Agendar con 3 mascotas/ }).click();
    await expect(page.getByRole("heading", { name: /Elige fecha y horario/ })).toBeVisible();

    // 2. Último día habilitado (futuro) y primera franja disponible
    const dayButtons = page.locator(".grid.grid-cols-7").locator("button:not([disabled])");
    await dayButtons.last().click();
    await expect(page.getByText(/¡Perfecto! Elige tu horario/)).toBeVisible();
    const noon = page.getByRole("button", { name: /Turno mediodía/ });
    const morning = page.getByRole("button", { name: /Turno mañana/ });
    if (await noon.isEnabled()) {
      await noon.click();
    } else {
      await morning.click();
    }
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    // 3. Datos del cliente: prellenados por el perfil, Solo enfocar "Continuar"
    await expect(page.getByRole("heading", { name: /Datos del cliente/ })).toBeVisible();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();

    // 4. Resumen: mascotas + fecha elegida, debemos poder confirmar
    await expect(page.getByRole("heading", { name: /Revisa y confirma tu reserva/ })).toBeVisible();
    await expect(page.getByText("Rocky")).toBeVisible();
    await expect(page.getByText("Luna")).toBeVisible();
    await expect(page.getByText("Michi")).toBeVisible();

    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: /Confirmar Reserva/ }).click();

    // 5. El servidor interceptado responde ok → pantalla de éxito
    await expect(page.getByText(/¡Solicitud enviada con éxito!/)).toBeVisible();
    await expect(page.getByText(/VA-[A-Z0-9]{5}/)).toBeVisible();
  });

  test("después de reservar el perfil queda guardado para la próxima visita", async ({ page }) => {
    await page.getByRole("button", { name: /Agendar con 3 mascotas/ }).click();
    const dayButtons = page.locator(".grid.grid-cols-7").locator("button:not([disabled])");
    await dayButtons.last().click();
    const noon = page.getByRole("button", { name: /Turno mediodía/ });
    const morning = page.getByRole("button", { name: /Turno mañana/ });
    if (await noon.isEnabled()) {
      await noon.click();
    } else {
      await morning.click();
    }
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await page.getByLabel(/He leído y acepto/).check();
    await page.getByRole("button", { name: /Confirmar Reserva/ }).click();
    await expect(page.getByText(/¡Solicitud enviada con éxito!/)).toBeVisible();

    // Recargar sin demo: el cliente recurrente sigue reconocido
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();
    await expect(page.getByText("Rocky")).toBeVisible();
    await expect(page.getByText("Luna")).toBeVisible();
    await expect(page.getByText("Michi")).toBeVisible();
  });
});
