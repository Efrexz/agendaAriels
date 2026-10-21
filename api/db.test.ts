import { describe, it, expect } from "vitest";
import { phoneMatchesDigits } from "./db.js";

describe("phoneMatchesDigits (búsqueda por teléfono normalizada)", () => {
  it("matchea teléfonos guardados con guiones cuando se busca solo dígitos", () => {
    expect(phoneMatchesDigits("917-104-426", "917104426")).toBe(true);
    expect(phoneMatchesDigits("986-985-047", "986985047")).toBe(true);
  });

  it("matchea con prefijo de país +51 buscado sin prefijo", () => {
    expect(phoneMatchesDigits("+51 917 104 426", "917104426")).toBe(true);
    expect(phoneMatchesDigits("51917104426", "917104426")).toBe(true);
  });

  it("NO matchea dígitos de otro teléfono", () => {
    expect(phoneMatchesDigits("917-104-426", "986985047")).toBe(false);
    expect(phoneMatchesDigits("917-104-426", "12345678")).toBe(false);
  });

  it("matchea con menos dígitos de los guardados (búsqueda parcial >= 6)", () => {
    expect(phoneMatchesDigits("917-104-426", "104426")).toBe(true);
  });

  it("soporta celular alterno (mobilityPhone) en la misma comparación", () => {
    expect(phoneMatchesDigits("987-654-321", "987654321")).toBe(true);
  });
});
