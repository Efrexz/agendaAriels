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

/** Fecha de PRÓXIMA semANa para specs médicos: jueves de la semana próxima
 *  (dentro SIEMPRE de la ventana semana-en-curso + próxima, sea cual sea el día
 *  de hoy, incluido domingo), más si el calendario necesita navegar de mes. */
export function proximaSemanaMedica(): { hoyKey: string; NEXT_DAY: string; needsNav: boolean } {
  const hoyKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
  const t = new Date(`${hoyKey}T12:00:00Z`);
  const wd = t.getUTCDay();
  const daysToMonday = wd === 0 ? 1 : 8 - wd; // lunes de la semana próxima
  const NEXT_DAY = new Date(t.getTime() + (daysToMonday + 3) * 86400_000)
    .toISOString().slice(0, 10);
  return { hoyKey, NEXT_DAY, needsNav: NEXT_DAY.slice(0, 7) !== hoyKey.slice(0, 7) };
}

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
