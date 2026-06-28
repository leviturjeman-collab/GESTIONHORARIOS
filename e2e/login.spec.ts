import { test, expect } from "@playwright/test";

test.describe("Acceso y enrutado por rol", () => {
  test("el administrador inicia sesión y llega al dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "admin@demo.es");
    await page.fill("#password", "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/inicio/, { timeout: 20000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
  });

  test("el empleado no puede entrar a una ruta de responsable", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "alba@demo.es");
    await page.fill("#password", "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/mi-cuadrante/, { timeout: 20000 });
    // Intenta acceder a costes (solo responsables) → debe redirigir fuera.
    await page.goto("/costes");
    await expect(page).not.toHaveURL(/\/costes/);
  });

  test("credenciales incorrectas muestran error", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "admin@demo.es");
    await page.fill("#password", "incorrecta");
    await page.click('button[type="submit"]');
    await expect(page.getByText(/correo o contraseña incorrectos/i)).toBeVisible();
  });
});
