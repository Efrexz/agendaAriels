/**
 * Flujo de primeras visitas: intro para primera vez (sin datos guardados).
 * Cada test parte de localStorage limpio (`?demo=0` fuerza la limpieza;
 * además  NO usamos storageState compartido entre specs).
 */
import { test, expect } from "@playwright/test";

test.describe("Bienvenida - primera vez", () => {
  test("la primera vez muestra la intro con la expectativa y avanza a Sede", async ({ page }) => {
    // ?demo=0 limpia el perfil (solo actúa en dev) y deja el estado de primera vez
    await page.goto("/?demo=0");
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "¿Es tu primera vez agendando grooming aquí?" })).toBeVisible();
    await expect(page.getByText(/solo la primera vez te pediremos tus datos/i)).toBeVisible();
    await expect(page.getByText("Paso 1 de 9")).toBeVisible();

    await page.getByRole("button", { name: /Comenzar mi reserva/ }).click();
    await expect(page.getByRole("heading", { name: /Selecciona tu sede/i })).toBeVisible();
    await expect(page.getByText("Paso 2 de 9")).toBeVisible();
  });

  test("intro explica qué se guarda y qué no", async ({ page }) => {
    await page.goto("/");
    // Expectativa explícita: primera vez flujo completo, luego rápido
    await expect(page.getByText(/tu primera reserva toma el flujo completo/i)).toBeVisible();
    await expect(page.getByText(/la próxima vez verás aquí tus mascotas/i)).toBeVisible();
  });
});
