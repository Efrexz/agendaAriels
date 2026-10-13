import { describe, it, expect } from "vitest";
import {
  createProfileFromFormData,
  createPrefilledFormData,
  saveClientProfile,
  saveClientProfileMerged,
  overwriteClientProfile,
  loadClientProfile,
  clearClientProfile,
  MAX_SAVED_PETS,
} from "./clientProfile";
import { INITIAL_FORM_DATA, type FormData, type PetData } from "../state/wizardReducer";

function storageStub() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

function bookingForm(overrides: Partial<FormData> = {}): FormData {
  return {
    ...INITIAL_FORM_DATA,
    branch: "san_martin",
    pets: [
      {
        petType: "dog",
        service: "bath_cut",
        extraServices: [{ service: "antiflea" }],
        size: "medium",
        coat: "normal",
        petNotes: "",
        petName: "Firulais",
        corteType: "rebaje",
        corteSpecs: "",
        corteImage: "",
        bathType: "tradicional",
        perfume: "fresco",
      },
    ],
    ownerName: "Juan Pérez",
    ownerPhone: "999888777",
    ownerAddress: "Av. Ideal 1234, San Isidro",
    ownerLat: -12.09,
    ownerLng: -77.03,
    hasHistory: true,
    ownerDni: "12345678",
    registeredPhone: "999888777",
    legalAgeConfirmed: true,
    ...overrides,
  };
}

describe("createProfileFromFormData / createPrefilledFormData", () => {
  it("no guarda campos de sesión (fecha, horario) ni legales", () => {
    const form = bookingForm({ date: "2026-10-20", timeRange: "9-11" });
    const profile = createProfileFromFormData(form);

    expect(profile.owner).not.toHaveProperty("date");
    expect(profile.owner).not.toHaveProperty("timeRange");
    expect(profile.owner).not.toHaveProperty("legalAgeConfirmed");
    expect(profile.pets).toHaveLength(1);
  });

  it("el prefilled restaura dueño y mascotas dentro de FormData", () => {
    const profile = createProfileFromFormData(bookingForm());
    const restored = createPrefilledFormData(profile);

    expect(restored.ownerAddress).toBe("Av. Ideal 1234, San Isidro");
    expect(restored.ownerLat).toBe(-12.09);
    expect(restored.pets[0].petName).toBe("Firulais");
    expect(restored.date).toBe(null);
    expect(restored.timeRange).toBe(null);
  });
});

describe("save/load/clear profile", () => {
  it("sobrevive un ciclo guardar → limpiar → cargar", () => {
    const storage = storageStub();
    saveClientProfile(bookingForm(), storage);
    const loaded = loadClientProfile(storage);
    expect(loaded?.owner.ownerName).toBe("Juan Pérez");
    expect(loaded?.pets[0].service).toBe("bath_cut");
  });

  it("descarta y borra un perfil corrupto", () => {
    const storage = storageStub();
    saveClientProfile(bookingForm(), storage);
    storage.setItem("va_client_profile_v1", "nada-que-ver{");
    expect(loadClientProfile(storage)).toBeNull();
    expect(storage.getItem("va_client_profile_v1")).toBeNull();
  });

  it("descarta un perfil con campos inválidos", () => {
    const storage = storageStub();
    saveClientProfile(bookingForm(), storage);
    const stored = JSON.parse(storage.getItem("va_client_profile_v1")!);
    stored.pets[0].service = "servicio_inexistente";
    storage.setItem("va_client_profile_v1", JSON.stringify(stored));
    expect(loadClientProfile(storage)).toBeNull();
  });

  it("clear elimina el perfil", () => {
    const storage = storageStub();
    saveClientProfile(bookingForm(), storage);
    clearClientProfile(storage);
    expect(loadClientProfile(storage)).toBeNull();
  });

  it("sin storage no explota", () => {
    expect(() => saveClientProfile(bookingForm(), null)).not.toThrow();
    expect(loadClientProfile(null)).toBeNull();
    expect(clearClientProfile(null)).toBeUndefined();
  });
});

function pet(petName: string, overrides: Partial<PetData> = {}): PetData {
  return {
    petType: "dog",
    service: "bath",
    extraServices: [],
    size: "small",
    coat: "normal",
    petNotes: "",
    petName,
    corteType: null,
    corteSpecs: "",
    corteImage: "",
    bathType: "tradicional",
    perfume: null,
    ...overrides,
  };
}

function withPets(pets: PetData[]): FormData {
  const form = bookingForm();
  form.pets = pets;
  return form;
}

describe("saveClientProfileMerged (unión de mascotas)", () => {
  it("conserva las mascotas anteriores que no van esta reserva", () => {
    const storage = storageStub();
    saveClientProfile(withPets([pet("Rocky"), pet("Firulais")]), storage);
    // Esta vez solo va Firulais
    const profile = saveClientProfileMerged(withPets([pet("Firulais", { service: "bath_cut" })]), storage);

    const names = profile.pets.map((p) => p.petName).sort();
    expect(names).toEqual(["Firulais", "Rocky"]);
    // La reserva de esta vez gana: Firulais quedó con el servicio nuevo
    expect(profile.pets.find((p) => p.petName === "Firulais")?.service).toBe("bath_cut");
  });

  it("no duplica mascotas con igual nombre (case-insensitive)", () => {
    const storage = storageStub();
    saveClientProfile(withPets([pet("Rocky")]), storage);
    const profile = saveClientProfileMerged(withPets([pet(" rocky ")]), storage);
    expect(profile.pets.filter((p) => p.petName.trim().toLowerCase() === "rocky")).toHaveLength(1);
  });

  it("respeta el tope MAX_SAVED_PETS", () => {
    const storage = storageStub();
    saveClientProfile(withPets(Array.from({ length: 10 }, (_, i) => pet(`Perro${i}`))), storage);
    const profile = saveClientProfileMerged(withPets([pet("Nueva")]), storage);
    expect(profile.pets).toHaveLength(MAX_SAVED_PETS);
    expect(profile.pets[0].petName).toBe("Nueva");
  });
});

describe("overwriteClientProfile (borrar mascota guardada)", () => {
  it("reescribe el listado de mascotas manteniendo al dueño", () => {
    const storage = storageStub();
    saveClientProfile(withPets([pet("Rocky"), pet("Firulais")]), storage);

    overwriteClientProfile(bookingForm(), [pet("Firulais")], storage);
    const loaded = loadClientProfile(storage);
    expect(loaded?.owner.ownerName).toBe("Juan Pérez");
    expect(loaded?.pets.map((p) => p.petName)).toEqual(["Firulais"]);
  });
});
