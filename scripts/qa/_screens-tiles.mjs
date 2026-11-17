// Capturas del wizard reorganizado (17/11): tile unificado de imágenes
// (sub-selección con precios) + tile de laboratorio (pregunta de orden).
import { chromium } from "playwright";

const OUT = "/tmp/opencode/qa-screens";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// mock: /api/medical/prices para ver el "Desde S/"
await page.route("**/api/medical/prices*", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, rayos: "120", eco: "150" }) }));

await page.goto("http://localhost:5173/medical.html", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// sede → servicios
await page.locator("button:has-text('Seleccionar sede')").first().click();
await page.waitForTimeout(400);
await page.locator("button:has-text('Ver servicios disponibles')").first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/servicios-4-tiles.png` });

// tile imágenes → sub-selección con precios
await page.locator("button:has-text('Rayos X y Ecografía')").first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/examen-subseleccion.png` });

// elegir radiografía → paso orden
await page.locator("button:has-text('Radiografía')").first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/orden-rayos.png` });

// lab: volver al servicio (3 backs: orden→examen→servicio→sede) y elegir lab
await page.locator("button:has-text('Volver atrás')").first().click();
await page.waitForTimeout(500);
await page.locator("button:has-text('Volver atrás')").first().click();
await page.waitForTimeout(500);
await page.locator("button:has-text('Volver atrás')").first().click();
await page.waitForTimeout(600);
await page.locator("button:has-text('Ver servicios disponibles')").first().click();
await page.waitForTimeout(900);
await page.locator("button:has-text('Exámenes de Laboratorio')").first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/orden-lab.png` });

// lab: "Sí, tengo orden" → subir orden
await page.locator("button:has-text('Sí, tengo orden')").first().click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/subir-orden-lab.png` });

await browser.close();
console.log("capturas en", OUT);
