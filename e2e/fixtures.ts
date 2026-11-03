import { test as base, expect, type Page } from "@playwright/test";

// Las pruebas E2E son locales: nunca deben contactar Maps, webhooks, Supabase
// u otros servicios externos. Cada prueba puede simular la respuesta que use.
export const test = base.extend({
  page: async ({ page }, runWithPage) => {
    await page.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return (url.hostname === "localhost" || url.hostname === "127.0.0.1") && url.port === "5173"
        ? route.continue()
        : route.abort();
    });
    await runWithPage(page);
  },
});

/** Elige una franja horaria SIEMPRE disponible: si los turnos del día de HOY
 *  ya vencieron (el texto cambia a "Ya no disponible"/"Ocupado"), avanza al
 *  mes siguiente y toma su último día habilitado, cuyas franjas nunca están
 *  vencidas por hora. No depende de la hora a la que corran los tests. */
export async function elegirFranjaDisponible(page: Page): Promise<void> {
  await expect(page.getByText(/¡Perfecto! Elige tu horario/)).toBeVisible();
  const noon = page.getByRole("button", { name: /Turno mediodía/ });
  const morning = page.getByRole("button", { name: /Turno mañana/ });
  const noonViva = (await noon.count()) > 0 && (await noon.isEnabled());
  const morningViva = (await morning.count()) > 0 && (await morning.isEnabled());
  if (!noonViva && !morningViva) {
    await page.getByRole("button", { name: "Mes siguiente" }).click();
    await page.locator(".grid.grid-cols-7").locator("button:not([disabled])").last().click();
    await expect(page.getByText(/¡Perfecto! Elige tu horario/)).toBeVisible();
  }
  if (await noon.isEnabled()) await noon.click();
  else await morning.click();
}

export { expect };
