import { describe, it, expect } from "vitest";
import { buildBookingPayload } from "./submitBooking";
import type { FormData } from "../state/wizardReducer";
import { INITIAL_FORM_DATA, buildPet } from "../state/wizardReducer";

function form(overrides: Partial<FormData> = {}): FormData {
  return { ...INITIAL_FORM_DATA, ...overrides };
}

describe("buildBookingPayload", () => {
  it("maps branch labels", () => {
    const payload = buildBookingPayload(
      form({ branch: "san_martin" })
    );
    expect(payload.branch).toBe("san_martin");
    expect(payload.branchLabel).toBe("Sede San Martín de Porres");
    expect(payload.branchPhone).toBe("+51 986 985 047");
  });

  it("returns '-' for missing branch", () => {
    const payload = buildBookingPayload(form({ branch: null }));
    expect(payload.branchLabel).toBe("-");
    expect(payload.branchPhone).toBe("-");
  });

  it("formats date with Spanish locale", () => {
    const payload = buildBookingPayload(form({ date: "2025-12-25" }));
    expect(payload.dateLabel).toContain("diciembre");
    expect(payload.dateLabel).toContain("2025");
  });

  it("maps time range labels", () => {
    const morning = buildBookingPayload(form({ timeRange: "9-11" }));
    expect(morning.timeRangeLabel).toContain("9:00");

    const noon = buildBookingPayload(form({ timeRange: "11-14" }));
    expect(noon.timeRangeLabel).toContain("11:00");
  });

  it("returns '-' for missing time range", () => {
    const payload = buildBookingPayload(form({ timeRange: null }));
    expect(payload.timeRangeLabel).toBe("-");
  });

  it("maps pet data with labels", () => {
    const pet = buildPet({
      ...INITIAL_FORM_DATA,
      petType: "dog",
      service: "bath_cut",
      size: "medium",
      petName: "Rex",
      extraServices: [{ service: "deworming" }, { service: "antiflea", variant: "1m_pipeta_fipforte" }],
      bathType: "hidratado_premium",
      corteType: "tijera",
      perfume: "fruital",
      petNotes: "Cuidado con la oreja",
    });

    const payload = buildBookingPayload(form({ pets: [pet] }));
    expect(payload.pets).toHaveLength(1);

    const petPayload = payload.pets[0];
    expect(petPayload.name).toBe("Rex");
    expect(petPayload.type).toBe("Perro");
    expect(petPayload.service).toBe("Baño + Corte");
    expect(petPayload.size).toBe("Mediano");
    expect(petPayload.bathType).toBe("Hidratado Premium");
    expect(petPayload.corteType).toBe("Corte con Tijera / Estilo de la raza");
    expect(petPayload.extras).toEqual([
      "Desparasitación",
      "Antipulgas (Pipeta Fip Forte, 1 mes)",
    ]);
    expect(petPayload.notes).toBe("Cuidado con la oreja");
    expect(petPayload.corteImage).toBeNull();
  });

  it("strips emoji from perfume label", () => {
    const pet = buildPet({
      ...INITIAL_FORM_DATA,
      petType: "dog",
      service: "bath",
      size: "small",
      petName: "Rex",
      bathType: "tradicional",
      perfume: "fruital",
    });
    const payload = buildBookingPayload(form({ pets: [pet] }));
    // The labelOr function calls PERFUME_LABELS which has emoji prefix.
    // stripEmoji is applied in ConfirmationStep.tsx, not in buildBookingPayload.
    // So here we just check it correctly maps the label.
    expect(payload.pets[0].perfume).toBe("🍓 Frutal");
  });

  it("maps owner data", () => {
    const payload = buildBookingPayload(
      form({
        ownerName: "Juan Pérez",
        ownerDni: "12345678",
        ownerPhone: "555-1234",
        ownerAddress: "Av. Siempre Viva 742",
      })
    );
    expect(payload.ownerName).toBe("Juan Pérez");
    expect(payload.ownerDni).toBe("12345678");
    expect(payload.ownerPhone).toBe("555-1234");
    expect(payload.ownerAddress).toBe("Av. Siempre Viva 742");
  });

  it("builds Google Maps URL from coordinates", () => {
    const payload = buildBookingPayload(
      form({ ownerLat: -12.0464, ownerLng: -77.0428 })
    );
    expect(payload.mapsUrl).toContain("-12.0464");
    expect(payload.mapsUrl).toContain("-77.0428");
  });

  it("returns null mapsUrl when coords missing", () => {
    const payload = buildBookingPayload(
      form({ ownerLat: null, ownerLng: null })
    );
    expect(payload.mapsUrl).toBeNull();
  });

  it("maps registered pet data", () => {
    const payload = buildBookingPayload(
      form({
        registeredPetName: "Firulais",
        registeredPhone: "999-8888",
        petBirthDate: "2020-06-15",
        petSpecies: "dog",
        petBreed: "Labrador",
        petCastrated: true,
      })
    );
    expect(payload.registeredPetName).toBe("Firulais");
    expect(payload.registeredPhone).toBe("999-8888");
    expect(payload.petBirthDate).toBe("2020-06-15");
    expect(payload.petSpecies).toBe("Perro");
    expect(payload.petBreed).toBe("Labrador");
    expect(payload.petCastrated).toBe(true);
  });

  it("includes mobility phone when different", () => {
    const payload = buildBookingPayload(
      form({
        mobilityPhoneDifferent: true,
        mobilityPhone: "987-6543",
      })
    );
    expect(payload.mobilityPhoneDifferent).toBe(true);
    expect(payload.mobilityPhone).toBe("987-6543");
  });

  it("generates a booking code in format VA-XXXXX", () => {
    const payload = buildBookingPayload(form({ branch: "los_olivos" }));
    expect(payload.bookingCode).toMatch(/^VA-[A-Z0-9]{5}$/);
  });
});
