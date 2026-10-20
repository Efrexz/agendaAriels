import { describe, it, expect } from "vitest";
import { closureFor, resetAvailabilityCache, type ClosureEntry } from "./availability";

const CLOSURES: ClosureEntry[] = [
  { branch: "san_martin", date: "2026-10-20", timeSlot: null },
  { branch: "san_martin", date: "2026-10-21", timeSlot: "9-11" },
  { branch: "los_olivos", date: "2026-10-21", timeSlot: "11-14" },
];

describe("closureFor", () => {
  it("día completo cerrado", () => {
    const c = closureFor(CLOSURES, "san_martin", "2026-10-20");
    expect(c.all).toBe(true);
    expect(c.slots.size).toBe(0);
  });

  it("solo una franja cerrada", () => {
    const c = closureFor(CLOSURES, "san_martin", "2026-10-21");
    expect(c.all).toBe(false);
    expect(c.slots.has("9-11")).toBe(true);
    expect(c.slots.has("11-14")).toBe(false);
  });

  it("no mezcla sedes", () => {
    const c = closureFor(CLOSURES, "san_miguel", "2026-10-20");
    expect(c.all).toBe(false);
    expect(c.slots.size).toBe(0);
  });

  it("sin sede elegida no hay cierres", () => {
    expect(closureFor(CLOSURES, null, "2026-10-20").all).toBe(false);
  });
});

describe("resetAvailabilityCache", () => {
  it("existe para limpiar el cache entre tests", () => {
    expect(() => resetAvailabilityCache()).not.toThrow();
  });
});
