import { describe, it, expect } from "vitest";
import { buildBookingPayload } from "../src/services/submitBooking";
import { bookingPayloadSchema } from "./booking";
import type { FormData } from "../src/state/wizardReducer";
import { INITIAL_FORM_DATA, buildPet } from "../src/state/wizardReducer";

function form(overrides: Partial<FormData> = {}): FormData {
  return { ...INITIAL_FORM_DATA, ...overrides };
}

describe("contrato frontend ↔ /api/booking", () => {
  it("un payload real del flujo React pasa la validación del servidor", () => {
    const pet = buildPet({
      ...INITIAL_FORM_DATA,
      petType: "dog",
      service: "bath_cut",
      size: "medium",
      petName: "Rex",
      bathType: "hidratado_premium",
      corteType: "rapado",
    });

    const payload = buildBookingPayload(
      form({
        branch: "san_martin",
        pets: [pet],
        date: "2026-10-10",
        timeRange: "9-11",
        ownerName: "Juan Pérez",
        ownerDni: "12345678",
        ownerPhone: "999-123-456",
        ownerAddress: "Av. Proceres 500",
        ownerLat: -12.0206,
        ownerLng: -77.0865,
        hasHistory: false,
      }),
    );

    const result = bookingPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("buildBookingPayload incluye timeRange junto a timeRangeLabel", () => {
    const payload = buildBookingPayload(form({ timeRange: "11-14" }));
    expect(payload.timeRange).toBe("11-14");
    expect(payload.timeRangeLabel).toContain("11:00");
  });

  it("el payload completo sin datos falla la validación (defensa)", () => {
    expect(bookingPayloadSchema.safeParse({}).success).toBe(false);
  });
});
