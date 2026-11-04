import { test, expect, proximaSemanaMedica } from "./fixtures";

// HOTFIX V1.1: carrera de slots en la agenda médica. Elegir un día en curso
// (respuesta LENTA, 2s) y después hacer clic rápido a un día de próxima semana
// NO debe pintar los horarios obsoletos bajo la banda "Semana por confirmar":
// 0 slots pintados, banda sola.
test("carrera: slots lentos del día en curso no reaparecen al pasar a próxima semana", async ({ page }) => {
  const { hoyKey, NEXT_DAY, needsNav } = proximaSemanaMedica();

  let slotsPedidosProxima = 0;
  await page.route("**/api/availability", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, closures: [] }) }));
  await page.route("**/api/medical/availability?**", async (route) => {
    const u = new URL(route.request().url());
    const date = u.searchParams.get("date");
    if (date === NEXT_DAY) {
      slotsPedidosProxima++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, slots: [] }) });
    }
    // Día en curso: respuesta LENTA con horarios que huelen a "viejos" si reaparecen.
    await new Promise((r) => setTimeout(r, 2000));
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, slots: [{ startMinute: 540 }, { startMinute: 600 }] }),
    });
  });
  await page.route("**/api/medical/doctors?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, doctors: [{ id: "00000000-0000-4000-8000-000000000111", name: "Dr. Lunes", kind: "general", specialty: null }] }),
  }));

  await page.goto("/medical.html");
  await page.getByRole("button", { name: /Sede San Miguel/ }).click();
  await page.getByRole("button", { name: /Ver servicios disponibles/ }).click();
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.getByRole("button", { name: /Dr\. Lunes/ }).click();

  const btnHoy = page.locator("button:not([disabled])", { hasText: new RegExp(`^${Number(hoyKey.slice(-2))}$`) }).first();
  const btnProximo = page.locator("button:not([disabled])", { hasText: new RegExp(`^${Number(NEXT_DAY.slice(-2))}$`) }).first();

  // Clic HOY (arranca el fetch lento del día en curso) y ADEMÁS, muy rápido,
  // el día de próxima semana: quedan juntos cuando ya se eligió el día
  // futuro (la situación que reportó el dueño). Si esa semana cae en otro
  // mes, la navegación "Mes siguiente" cabe dentro de la ventana de 2s.
  await btnHoy.click();
  if (needsNav) await page.getByRole("button", { name: "Mes siguiente" }).click();
  await btnProximo.click();

  // La banda aparece INMEDIATAMENTE (cancelSlotLoad mata el spinner pendiente).
  await expect(page.getByText(/Semana por confirmar/)).toBeVisible({ timeout: 5_000 });

  // Espera a que la respuesta lenta del día en curso RESUELVA (2s + margen):
  // con el hotfix se descarta y NO pinta horarios ni aviso de error.
  await page.waitForTimeout(2600);
  await expect(page.getByText(/Semana por confirmar/)).toBeVisible();
  await expect(page.getByText(/9:00 am/)).toHaveCount(0);
  await expect(page.getByText(/10:00 am/)).toHaveCount(0);
  await expect(page.getByText(/El doctor no tiene horas libres/)).toHaveCount(0);

  // El flujo de solicitud no consultó slots del día futuro.
  expect(slotsPedidosProxima).toBe(0);

  await page.screenshot({ path: "test-results/race-slots.png", fullPage: true });

  // Y el clic de VOLVER al día en curso sí carga sus horarios (la secuencia
  // nueva gana sobre la vieja): el guard no rompió la carga normal.
  if (needsNav) await page.getByRole("button", { name: "Mes anterior" }).click();
  await btnHoy.click();
  await expect(async () => {
    await expect(page.getByText(/9:00 am/).first()).toBeVisible({ timeout: 5_000 });
  }).toPass();
});
