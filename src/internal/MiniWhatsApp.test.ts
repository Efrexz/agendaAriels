import { describe, expect, it } from "vitest";
import { waLink } from "./waLink";

// Normalización del teléfono del dueño para wa.me (mini botón de las cards).
describe("waLink", () => {
  it("prefija +51 cuando el celular es de 9 dígitos", () => {
    expect(waLink("999 111 222", "hola")).toContain("https://wa.me/51999111222?text=hola");
  });

  it("no re-prefija si el número ya trae 51", () => {
    expect(waLink("+51 986 985 047", "hola")).toContain("wa.me/51986985047");
  });

  it("descarta placeholders y teléfonos incompletos", () => {
    expect(waLink("-", "hola")).toBeNull();
    expect(waLink("", "hola")).toBeNull();
    expect(waLink("999", "hola")).toBeNull();
  });
});
