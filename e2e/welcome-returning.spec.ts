import { test, expect } from "@playwright/test";

/**
 * Flujo de cliente recurrente: siembra de demo con 3 mascotas (?demo=1),
 * selección de mascotas, registrar nueva mascota con escape, y borrado
 * persistente de una mascota guardada.
 */
test.describe("Bienvenida - cliente recurrente (datos guardados)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=1");
  });

  test("saluda con las mascotas y datos guardados", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();
    await expect(page.getByText("Rocky")).toBeVisible();
    await expect(page.getByText("Luna")).toBeVisible();
    await expect(page.getByText("Michi")).toBeVisible();
    await expect(page.getByText("Demo Pérez")).toBeVisible();
    await expect(page.getByRole("button", { name: /Agendar con 3 mascotas/ })).toBeVisible();
  });

  test("desmarcar una mascota actualiza el botón y al volver sigue en la lista", async ({ page }) => {
    // Desmarcar a Luna: la carta es un div role=button que contiene "Luna"
    await page.locator('[role="button"]').filter({ hasText: "Luna" }).first().click();
    await expect(page.getByRole("button", { name: /Agendar con 2 mascotas/ })).toBeVisible();

    // Avanzar a fecha y volver: Luna sigue en la bienvenida (no se borró)
    await page.getByRole("button", { name: /Agendar con 2 mascotas/ }).click();
    await expect(page.getByRole("heading", { name: /Elige fecha y horario/ })).toBeVisible();
    await page.getByRole("button", { name: /Volver atrás/ }).click();
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();
    await expect(page.getByText("Luna")).toBeVisible();
    await expect(page.getByRole("button", { name: /Agendar con 3 mascotas/ })).toBeVisible();
  });

  test("registrar nueva mascota y volver regresa a la bienvenida (no al resumen)", async ({ page }) => {
    await page.getByRole("button", { name: /Registrar nueva mascota/ }).click();
    // petType es el paso 3 del flujo oficial (sede ya venía elegida de antes)
    await expect(page.getByText("Paso 3 de 9")).toBeVisible();

    // Volver: debe regresar a la bienvenida, NO al resumen
    await page.getByRole("button", { name: /Volver atrás/ }).click();
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();
    await expect(page.getByText("Paso 1 de 9")).toBeVisible();
    // El formulario abortado no rescató basura: las mascotas siguen siendo 3
    await expect(page.getByRole("button", { name: /Agendar con 3 mascotas/ })).toBeVisible();
  });

  test("eliminar mascota guardada con confirmación y persiste al recargar", async ({ page }) => {
    // Trash de Rocky: botón con aria-label que incluye su nombre
    await page.locator('button[aria-label*="Rocky"]').click();

    await expect(page.getByText(/¿Eliminar a Rocky de tus mascotas guardadas\?/)).toBeVisible();
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page.getByText("Rocky")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Agendar con 2 mascotas/ })).toBeVisible();

    // Persistencia: sin re-sembrar el demo, Rocky no reaparece
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /¡Qué gusto verte, Demo!/ })).toBeVisible();
    await expect(page.getByText("Rocky")).toHaveCount(0);
    await expect(page.getByText("Luna")).toBeVisible();
    await expect(page.getByText("Michi")).toBeVisible();
  });
});
