import { test, expect } from "./fixtures";

const order = {
  orderCode: "LAB-ABCDE", status: "resultado_listo", petName: "Mascota QA", examType: "Examen QA",
  sedeLabel: "Sede San Miguel", sedePhone: "+51999999999", createdAt: "2026-10-30T10:00:00Z",
  timeline: [], resultAvailable: true,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/lab-status?**", (route) => route.fulfill({ json: { ok: true, order } }));
});

test("con código solamente no ofrece descargar y explica cómo obtener el enlace", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/lab-download", (route) => { requests++; return route.abort(); });
  await page.goto("/status.html?code=LAB-ABCDE");
  await expect(page.getByText("Para descargarlo, abre el enlace privado", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Descargar resultado/ })).toHaveCount(0);
  expect(requests).toBe(0);
});

test("enlace privado solicita descarga solo al hacer clic", async ({ page }) => {
  const token = "A".repeat(43);
  let body: unknown;
  await page.route("**/api/lab-download", async (route) => {
    body = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, url: "http://localhost:5173/" } });
  });
  await page.goto(`/status.html?code=LAB-ABCDE#resultado=${token}`);
  const button = page.getByRole("button", { name: /Descargar resultado/ });
  await expect(button).toBeVisible();
  expect(body).toBeUndefined();
  await button.click();
  await expect.poll(() => body).toEqual({ code: "LAB-ABCDE", token });
});

test("el enlace revocado muestra cómo pedir otro", async ({ page }) => {
  await page.route("**/api/lab-download", (route) => route.fulfill({ status: 404, json: { ok: false, error: "Enlace no disponible o vencido. Solicita uno nuevo a la sede." } }));
  await page.goto(`/status.html?code=LAB-ABCDE#resultado=${"A".repeat(43)}`);
  await page.getByRole("button", { name: /Descargar resultado/ }).click();
  await expect(page.getByRole("alert")).toContainText("Solicita uno nuevo a la sede");
});
