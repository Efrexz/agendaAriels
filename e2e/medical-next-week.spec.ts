import { test, expect, proximaSemanaMedica } from "./fixtures";

// Solicitud de PRÓXIMA semana (M2 B): la banda aparece, NO se consultan slots
// del día futuro y el create devuelve `requested` con copy de solicitud.
test("próxima semana: solicitud sin hora y aviso honesto", async ({ page }) => {
  const { NEXT_DAY, needsNav } = proximaSemanaMedica();

  let slotsPedidos = 0;
  await page.route("**/api/availability", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, closures: [] }) }));
  await page.route("**/api/medical/availability?**", async (route) => {
    const u = new URL(route.request().url());
    if (u.searchParams.get("date") === NEXT_DAY) slotsPedidos++;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, slots: [] }) });
  });
  await page.route("**/api/medical/doctors?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, doctors: [{ id: "00000000-0000-4000-8000-000000000111", name: "Dr. Lunes", kind: "general", specialty: null }] }),
  }));
  await page.route("**/api/medical/create", async (route) => {
    const body = route.request().postDataJSON() as { date: string; startMinute: number | null };
    expect(body.date).toBe(NEXT_DAY);
    expect(body.startMinute).toBeNull();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, appointmentCode: "CM-WEEK1", requested: true }) });
  });

  await page.goto("/medical.html");
  await page.getByRole("button", { name: /Sede San Miguel/ }).click();
  await page.getByRole("button", { name: /Ver servicios disponibles/ }).click();
  await page.getByRole("button", { name: /Consulta General/ }).click();
  await page.getByRole("button", { name: /Dr\. Lunes/ }).click();

  if (needsNav) await page.getByRole("button", { name: "Mes siguiente" }).click();
  const dia = NEXT_DAY.slice(-2);
  const btnDia = page.locator("button:not([disabled])", { hasText: new RegExp(`^${Number(dia)}$`) });
  await btnDia.first().click();

  await page.screenshot({ path: "test-results/nw3.png", fullPage: true });
  await expect(page.getByText(/Semana por confirmar/)).toBeVisible({ timeout: 15_000 });
  expect(slotsPedidos).toBe(0);

  await page.getByRole("button", { name: /Solicitar cita — confirmamos por WhatsApp/ }).click();
  await page.getByPlaceholder("Ej: Manolo").fill("Mascota QA");
  await page.getByPlaceholder("Ej: Juan Pérez").fill("Dueño QA");
  await page.getByPlaceholder("999 111 222").fill("999111222");
  await page.getByRole("button", { name: /Confirmar cita/ }).click();
  await expect(page.getByText("CM-WEEK1")).toBeVisible();
  await expect(page.getByText(/Solicitud registrada/i).first()).toBeVisible();
});
