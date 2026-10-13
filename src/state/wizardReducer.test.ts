import { describe, it, expect } from "vitest";
import {
  wizardReducer,
  nextStep,
  prevStep,
  buildPet,
  INITIAL_STATE,
  INITIAL_FORM_DATA,
  createInitialState,
  type WizardState,
  type FormData,
  type PetData,
} from "./wizardReducer";

function state(overrides: Partial<WizardState> = {}): WizardState {
  return { ...INITIAL_STATE, ...overrides };
}

function dogForm(overrides: Partial<FormData> = {}): FormData {
  return {
    ...INITIAL_FORM_DATA,
    branch: "san_martin",
    petType: "dog",
    service: "bath_cut",
    bathType: "hidratado_premium",
    size: "medium",
    petName: "Firulais",
    petSpecies: "dog",
    petBreed: "Labrador",
    ...overrides,
  };
}

function catForm(overrides: Partial<FormData> = {}): FormData {
  return {
    ...INITIAL_FORM_DATA,
    branch: "san_martin",
    petType: "cat",
    service: "bath_deslanado",
    bathType: "tradicional",
    petName: "Michi",
    petSpecies: "cat",
    petBreed: "Siamés",
    ...overrides,
  };
}

describe("nextStep", () => {
  it("branch → petType", () => {
    expect(nextStep("branch", INITIAL_FORM_DATA)).toBe("petType");
  });

  it("petType → petInfo", () => {
    expect(nextStep("petType", INITIAL_FORM_DATA)).toBe("petInfo");
  });

  it("petInfo → size for dogs", () => {
    expect(nextStep("petInfo", dogForm())).toBe("size");
  });

  it("petInfo → petAdded for cats (skip size)", () => {
    expect(nextStep("petInfo", catForm())).toBe("petAdded");
  });

  it("size → petAdded", () => {
    expect(nextStep("size", dogForm())).toBe("petAdded");
  });

  it("petAdded → schedule", () => {
    expect(nextStep("petAdded", dogForm())).toBe("schedule");
  });

  it("schedule → owner", () => {
    expect(nextStep("schedule", dogForm())).toBe("owner");
  });

  it("owner → review cuando hay fecha; sin fecha va a schedule", () => {
    expect(nextStep("owner", dogForm({ date: "2026-10-20" }))).toBe("review");
    expect(nextStep("owner", dogForm())).toBe("schedule");
  });

  it("review stays on review", () => {
    expect(nextStep("review", dogForm())).toBe("review");
  });
});

describe("prevStep", () => {
  it("branch stays on branch", () => {
    expect(prevStep("branch", INITIAL_FORM_DATA)).toBe("branch");
  });

  it("petType → branch", () => {
    expect(prevStep("petType", INITIAL_FORM_DATA)).toBe("branch");
  });

  it("petInfo → petType", () => {
    expect(prevStep("petInfo", dogForm())).toBe("petType");
  });

  it("size → petInfo", () => {
    expect(prevStep("size", dogForm())).toBe("petInfo");
  });

  it("petAdded → size for dogs", () => {
    expect(prevStep("petAdded", dogForm())).toBe("size");
  });

  it("petAdded → petInfo for cats", () => {
    expect(prevStep("petAdded", catForm())).toBe("petInfo");
  });

  it("schedule → size for dogs", () => {
    expect(prevStep("schedule", dogForm())).toBe("size");
  });

  it("schedule → petInfo for cats", () => {
    expect(prevStep("schedule", catForm())).toBe("petInfo");
  });

  it("owner → schedule", () => {
    expect(prevStep("owner", dogForm())).toBe("schedule");
  });

  it("review → owner", () => {
    expect(prevStep("review", dogForm())).toBe("owner");
  });
});

describe("buildPet", () => {
  it("builds dog with size", () => {
    const form = dogForm({
      petType: "dog",
      service: "bath_cut",
      size: "large",
      petName: "Rex",
      extraServices: [{ service: "deworming" }],
      bathType: "medicado",
      corteType: "rapado",
      perfume: "fruital",
      petNotes: "Miedo a la secadora",
    });
    const pet = buildPet(form);
    expect(pet).toEqual({
      petType: "dog",
      service: "bath_cut",
      extraServices: [{ service: "deworming" }],
      size: "large",
      coat: "normal",
      petNotes: "Miedo a la secadora",
      petName: "Rex",
      corteType: "rapado",
      corteSpecs: "",
      corteImage: "",
      bathType: "medicado",
      perfume: "fruital",
    } satisfies PetData);
  });

  it("builds cat with null size", () => {
    const form = catForm({
      petType: "cat",
      service: "bath_deslanado",
      petName: "Luna",
    });
    const pet = buildPet(form);
    expect(pet.size).toBeNull();
    expect(pet.petType).toBe("cat");
  });
});

describe("wizardReducer", () => {
  describe("NEXT", () => {
    it("advances through dog flow", () => {
      let s = state({ step: "branch", formData: dogForm() });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petType");

      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petInfo");

      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("size");

      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petAdded");
    });

    it("skips size for cats", () => {
      let s = state({ step: "petInfo", formData: catForm() });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petAdded");
    });

    it("stays on review", () => {
      const s = state({ step: "review", formData: dogForm() });
      const next = wizardReducer(s, { type: "NEXT" });
      expect(next.step).toBe("review");
    });
  });

  describe("BACK", () => {
    it("goes to previous step", () => {
      const s = state({ step: "petType", formData: dogForm() });
      const next = wizardReducer(s, { type: "BACK" });
      expect(next.step).toBe("branch");
    });

    it("cancels editing mode and returns to review", () => {
      const s = state({
        step: "petInfo",
        mode: "editing",
        editingIndex: 0,
        formData: { ...dogForm(), pets: [buildPet(dogForm())] },
      });
      const next = wizardReducer(s, { type: "BACK" });
      expect(next.step).toBe("review");
      expect(next.mode).toBe("initial");
      expect(next.editingIndex).toBeNull();
    });

    it("cancels addingFromSummary mode and returns to review", () => {
      const s = state({
        step: "petInfo",
        mode: "addingFromSummary",
        formData: catForm(),
      });
      const next = wizardReducer(s, { type: "BACK" });
      expect(next.step).toBe("review");
      expect(next.mode).toBe("initial");
    });

    it("removes last pet when going back from schedule and restores its data to the form", () => {
      const pet1 = buildPet(dogForm({ petName: "Rex" }));
      const pet2 = buildPet(dogForm({ petName: "Luna" }));
      const s = state({
        step: "schedule",
        formData: { ...dogForm(), pets: [pet1, pet2] },
      });
      const next = wizardReducer(s, { type: "BACK" });
      expect(next.formData.pets).toHaveLength(1);
      expect(next.formData.pets[0].petName).toBe("Rex");
      expect(next.formData.petName).toBe("Luna");
      expect(next.formData.service).toBe("bath_cut");
    });

    it("resets pet fields when going back to branch or petType", () => {
      const s = state({
        step: "petInfo",
        formData: dogForm({ petName: "Rex", petNotes: "test" }),
      });
      const next = wizardReducer(s, { type: "BACK" });
      expect(next.step).toBe("petType");
      expect(next.formData.petName).toBe("");
      expect(next.formData.petNotes).toBe("");
    });
  });

  describe("CONTINUE", () => {
    it("saves pet and goes to schedule in normal flow", () => {
      const s = state({
        step: "petAdded",
        mode: "initial",
        formData: dogForm(),
      });
      const next = wizardReducer(s, { type: "CONTINUE" });
      expect(next.step).toBe("schedule");
      expect(next.formData.pets).toHaveLength(1);
      expect(next.formData.pets[0].petName).toBe("Firulais");
    });

    it("resets pet draft fields after saving", () => {
      const s = state({
        step: "petAdded",
        mode: "initial",
        formData: dogForm(),
      });
      const next = wizardReducer(s, { type: "CONTINUE" });
      expect(next.formData.petName).toBe("");
      expect(next.formData.petType).toBeNull();
    });

    it("goes to review when in editing mode", () => {
      const existingPet = buildPet(dogForm({ petName: "Rex" }));
      const s = state({
        step: "petAdded",
        mode: "editing",
        editingIndex: 0,
        formData: {
          ...dogForm({ petName: "Rex Editado" }),
          pets: [existingPet],
        },
      });
      const next = wizardReducer(s, { type: "CONTINUE" });
      expect(next.step).toBe("review");
      expect(next.mode).toBe("initial");
      expect(next.formData.pets[0].petName).toBe("Rex Editado");
    });

    it("goes to review when in addingFromSummary mode", () => {
      const s = state({
        step: "petAdded",
        mode: "addingFromSummary",
        formData: dogForm({ petName: "Nueva" }),
      });
      const next = wizardReducer(s, { type: "CONTINUE" });
      expect(next.step).toBe("review");
      expect(next.mode).toBe("initial");
      expect(next.formData.pets).toHaveLength(1);
    });
  });

  describe("ADD_ANOTHER", () => {
    it("saves pet and goes to petType", () => {
      const s = state({
        step: "petAdded",
        mode: "initial",
        formData: dogForm({ petName: "Rex" }),
      });
      const next = wizardReducer(s, { type: "ADD_ANOTHER" });
      expect(next.step).toBe("petType");
      expect(next.formData.pets).toHaveLength(1);
      expect(next.formData.pets[0].petName).toBe("Rex");
      expect(next.formData.petName).toBe(""); // reset
    });

    it("replaces pet when editingIndex is set", () => {
      const existing = buildPet(dogForm({ petName: "Viejo" }));
      const s = state({
        step: "petAdded",
        mode: "editing",
        editingIndex: 1,
        formData: {
          ...dogForm({ petName: "Editado" }),
          pets: [
            buildPet(dogForm({ petName: "Primero" })),
            existing,
          ],
        },
      });
      const next = wizardReducer(s, { type: "ADD_ANOTHER" });
      expect(next.formData.pets).toHaveLength(2);
      expect(next.formData.pets[1].petName).toBe("Editado");
    });

    it("preserves mode", () => {
      const s = state({
        step: "petAdded",
        mode: "addingFromSummary",
        formData: dogForm(),
      });
      const next = wizardReducer(s, { type: "ADD_ANOTHER" });
      expect(next.mode).toBe("addingFromSummary");
    });
  });

  describe("ADD_FROM_CONFIRMATION", () => {
    it("resets form and goes to petType with addingFromSummary mode", () => {
      const s = state({
        step: "review",
        formData: { ...dogForm(), ownerName: "Juan" },
      });
      const next = wizardReducer(s, { type: "ADD_FROM_CONFIRMATION" });
      expect(next.step).toBe("petType");
      expect(next.mode).toBe("addingFromSummary");
      expect(next.formData.petName).toBe("");
      expect(next.formData.petType).toBeNull();
      expect(next.formData.ownerName).toBe("Juan"); // owner data preserved
    });
  });

  describe("EDIT_PET", () => {
    it("loads pet into form and sets editing mode", () => {
      const pet = buildPet(dogForm({
        petName: "Rex",
        service: "bath_cut",
        size: "large",
        bathType: "medicado",
        corteType: "tijera",
        extraServices: [{ service: "deworming" }],
      }));
      const s = state({
        step: "review",
        formData: { ...INITIAL_FORM_DATA, pets: [pet] },
      });
      const next = wizardReducer(s, { type: "EDIT_PET", index: 0 });
      expect(next.step).toBe("petInfo");
      expect(next.mode).toBe("editing");
      expect(next.editingIndex).toBe(0);
      expect(next.formData.petName).toBe("Rex");
      expect(next.formData.service).toBe("bath_cut");
      expect(next.formData.size).toBe("large");
      expect(next.formData.bathType).toBe("medicado");
      expect(next.formData.corteType).toBe("tijera");
      expect(next.formData.extraServices).toEqual([{ service: "deworming" }]);
    });

    it("returns same state if index is out of bounds", () => {
      const s = state({
        step: "review",
        formData: { ...INITIAL_FORM_DATA, pets: [] },
      });
      const next = wizardReducer(s, { type: "EDIT_PET", index: 5 });
      expect(next).toBe(s);
    });
  });

  describe("REMOVE_PET", () => {
    it("removes pet from array", () => {
      const pet1 = buildPet(dogForm({ petName: "Rex" }));
      const pet2 = buildPet(dogForm({ petName: "Luna" }));
      const s = state({
        step: "review",
        formData: { ...INITIAL_FORM_DATA, pets: [pet1, pet2] },
      });
      const next = wizardReducer(s, { type: "REMOVE_PET", index: 0 });
      expect(next.formData.pets).toHaveLength(1);
      expect(next.formData.pets[0].petName).toBe("Luna");
    });

    it("clears editingIndex if removing the pet being edited", () => {
      const pet = buildPet(dogForm({ petName: "Rex" }));
      const s = state({
        step: "review",
        editingIndex: 0,
        formData: { ...INITIAL_FORM_DATA, pets: [pet] },
      });
      const next = wizardReducer(s, { type: "REMOVE_PET", index: 0 });
      expect(next.editingIndex).toBeNull();
    });
  });

  describe("UPDATE_FIELD", () => {
    it("updates a form field", () => {
      const s = state();
      const next = wizardReducer(s, {
        type: "UPDATE_FIELD",
        field: "ownerName",
        value: "Juan Pérez",
      });
      expect(next.formData.ownerName).toBe("Juan Pérez");
    });

    it("does not affect other state properties", () => {
      const s = state({ step: "owner" });
      const next = wizardReducer(s, {
        type: "UPDATE_FIELD",
        field: "ownerDni",
        value: "12345678",
      });
      expect(next.step).toBe("owner");
      expect(next.mode).toBe("initial");
    });
  });

  describe("full flow simulation", () => {
    it("completes a dog booking end to end", () => {
      let s = state({ step: "branch", formData: INITIAL_FORM_DATA });

      // Select branch
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "branch", value: "san_martin" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petType");

      // Select dog
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petType", value: "dog" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petInfo");

      // Fill pet info
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petName", value: "Rex" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "service", value: "bath_cut" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "bathType", value: "hidratado_premium" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "corteType", value: "rapado" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("size");

      // Select size
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "size", value: "large" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petAdded");

      // Continue to schedule
      s = wizardReducer(s, { type: "CONTINUE" });
      expect(s.step).toBe("schedule");
      expect(s.formData.pets).toHaveLength(1);
      expect(s.formData.pets[0].petName).toBe("Rex");

      // Select date and time
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "date", value: "2025-08-15" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "timeRange", value: "9-11" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("owner");

      // Fill owner info
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "ownerName", value: "Juan" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "hasHistory", value: false });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("review");
    });

    it("completes a cat booking (skips size)", () => {
      let s = state({ step: "branch", formData: INITIAL_FORM_DATA });

      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "branch", value: "los_olivos" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petType");

      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petType", value: "cat" });
      s = wizardReducer(s, { type: "NEXT" });
      expect(s.step).toBe("petInfo");

      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petName", value: "Michi" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "service", value: "bath_deslanado" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "bathType", value: "tradicional" });
      s = wizardReducer(s, { type: "NEXT" });
      // Cat should skip size
      expect(s.step).toBe("petAdded");

      s = wizardReducer(s, { type: "CONTINUE" });
      expect(s.step).toBe("schedule");
      expect(s.formData.pets).toHaveLength(1);
      expect(s.formData.pets[0].petType).toBe("cat");
      expect(s.formData.pets[0].size).toBeNull();
    });

    it("adds multiple pets from summary", () => {
      let s = state({ step: "review", formData: INITIAL_FORM_DATA });

      // Add first pet from confirmation
      s = wizardReducer(s, { type: "ADD_FROM_CONFIRMATION" });
      expect(s.mode).toBe("addingFromSummary");

      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petType", value: "dog" });
      s = wizardReducer(s, { type: "NEXT" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petName", value: "Rex" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "service", value: "bath" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "bathType", value: "tradicional" });
      s = wizardReducer(s, { type: "NEXT" }); // to size
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "size", value: "medium" });
      s = wizardReducer(s, { type: "NEXT" }); // to petAdded
      s = wizardReducer(s, { type: "CONTINUE" }); // save, go to review
      expect(s.step).toBe("review");
      expect(s.formData.pets).toHaveLength(1);

      // Add second pet
      s = wizardReducer(s, { type: "ADD_FROM_CONFIRMATION" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petType", value: "cat" });
      s = wizardReducer(s, { type: "NEXT" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petName", value: "Luna" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "service", value: "bath_deslanado" });
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "bathType", value: "medicado" });
      s = wizardReducer(s, { type: "NEXT" }); // cat skips size → petAdded
      s = wizardReducer(s, { type: "CONTINUE" }); // save, go to review
      expect(s.step).toBe("review");
      expect(s.formData.pets).toHaveLength(2);
      expect(s.formData.pets[0].petName).toBe("Rex");
      expect(s.formData.pets[1].petName).toBe("Luna");
    });

    it("edits a pet from summary", () => {
      const pet = buildPet(dogForm({ petName: "Rex" }));
      let s = state({
        step: "review",
        formData: { ...INITIAL_FORM_DATA, pets: [pet] },
      });

      // Edit the pet
      s = wizardReducer(s, { type: "EDIT_PET", index: 0 });
      expect(s.step).toBe("petInfo");
      expect(s.mode).toBe("editing");
      expect(s.formData.petName).toBe("Rex");

      // Change name
      s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petName", value: "Rex Editado" });
      s = wizardReducer(s, { type: "NEXT" }); // size
      s = wizardReducer(s, { type: "NEXT" }); // petAdded
      s = wizardReducer(s, { type: "CONTINUE" }); // save, back to review
      expect(s.step).toBe("review");
      expect(s.formData.pets[0].petName).toBe("Rex Editado");
    });
  });
});

describe("flujo de bienvenida (perfil guardado)", () => {
  it("paso welcome existe en nextStep/prevStep", () => {
    expect(nextStep("welcome", INITIAL_FORM_DATA)).toBe("schedule");
    expect(prevStep("welcome", INITIAL_FORM_DATA)).toBe("welcome");
  });

  function profile(): { owner: Partial<FormData>; pets: FormData["pets"] } {
    const formData: FormData = {
      ...INITIAL_FORM_DATA,
      branch: "san_miguel",
      ownerName: "María López",
      ownerAddress: "Av. Algo 222",
      ownerLat: -12.1,
      ownerLng: -77.05,
      pets: [dogPet()],
    };
    return { owner: { ...formData }, pets: formData.pets };
  }

  function dogPet(): PetData {
    return {
      petType: "dog",
      service: "bath",
      extraServices: [],
      size: "small",
      coat: "normal",
      petNotes: "",
      petName: "Firulais",
      corteType: null,
      corteSpecs: "",
      corteImage: "",
      bathType: "tradicional",
      perfume: null,
    };
  }

  function catPet(): PetData {
    return {
      petType: "cat",
      service: "bath_deslanado",
      extraServices: [],
      size: null,
      coat: "normal",
      petNotes: "",
      petName: "Michi",
      corteType: null,
      corteSpecs: "",
      corteImage: "",
      bathType: "tradicional",
      perfume: "floral",
    };
  }

  it("createInitialState arranca en welcome con datos prellenados si hay perfil", () => {
    const s = createInitialState(() => profile());
    expect(s.step).toBe("welcome");
    expect(s.mode).toBe("quick");
    expect(s.formData.ownerName).toBe("María López");
    expect(s.formData.pets).toHaveLength(1);
  });

  it("createInitialState arranca en branch sin perfil", () => {
    const s = createInitialState(() => null);
    expect(s.step).toBe("welcome");
    expect(s.mode).toBe("initial");
    expect(s.formData).toEqual(INITIAL_FORM_DATA);
  });

  it("createInitialState arranca en welcome modo intro si el perfil no tiene mascotas", () => {
    const s = createInitialState(() => ({ owner: {}, pets: [] }));
    expect(s.step).toBe("welcome");
    expect(s.mode).toBe("initial");
  });

  it("USE_PROFILE lleva a schedule con las mascotas elegidas", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "USE_PROFILE", pets: [dogPet()] });
    expect(s.step).toBe("schedule");
    expect(s.formData.pets).toHaveLength(1);
  });

  it("USE_PROFILE con subset no toca profilePets (la desmarcada sigue guardada)", () => {
    let s = createInitialState(() => profile());
    s.formData.pets = [dogPet(), catPet()];
    s.profilePets = [dogPet(), catPet()];
    s = wizardReducer(s, { type: "USE_PROFILE", pets: [catPet()] });
    expect(s.step).toBe("schedule");
    expect(s.formData.pets).toHaveLength(1);
    expect(s.formData.pets[0].petName).toBe("Michi");
    expect(s.profilePets).toHaveLength(2);
  });

  it("USE_PROFILE con nada elegido se queda en welcome", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "USE_PROFILE", pets: [] });
    expect(s.step).toBe("welcome");
  });

  it("DELETE_SAVED_PET saca la mascota de profilePets y de la reserva actual por nombre", () => {
    let s = createInitialState(() => profile());
    s.formData.pets = [dogPet(), catPet()];
    s.profilePets = [dogPet(), catPet()];

    // Eliminar a Michi (índice 1 de profilePets)
    s = wizardReducer(s, { type: "DELETE_SAVED_PET", index: 1 });
    expect(s.profilePets).toHaveLength(1);
    expect(s.profilePets[0].petName).toBe("Firulais");
    expect(s.formData.pets).toHaveLength(1);
    expect(s.formData.pets[0].petName).toBe("Firulais");
  });

  it("START_BOOKING lleva a branch en modo intro", () => {
    const s = wizardReducer(createInitialState(() => null), { type: "START_BOOKING" });
    expect(s.step).toBe("branch");
    expect(s.mode).toBe("initial");
  });

  it("ADD_PET_FROM_WELCOME va a petType y limpia los campos de mascota", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "ADD_PET_FROM_WELCOME" });
    expect(s.step).toBe("petType");
    expect(s.mode).toBe("quick");
    expect(s.formData.petName).toBe("");
    expect(s.formData.pets).toHaveLength(1);
    s.formData.service = "bath";
    s.formData.petName = "Rex";
    s = wizardReducer(s, { type: "CONTINUE" });
    expect(s.step).toBe("schedule");
    expect(s.formData.pets).toHaveLength(2);
    expect(s.formData.pets[1].petName).toBe("Rex");
    // La nueva mascota también entra al listado guardado
    expect(s.profilePets).toHaveLength(2);
  });

  it("BACK en modo quick tiene mapa explícito", () => {
    // Desde petType (registrar nueva mascota abortada) → welcome, descartando lo tecleado
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "ADD_PET_FROM_WELCOME" });
    s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petName", value: "Rex" });
    s = wizardReducer(s, { type: "BACK" });
    expect(s.step).toBe("welcome");
    expect(s.formData.petName).toBe("");
    expect(s.formData.pets).toHaveLength(1);

    // Desde schedule → welcome, conservando las mascotas
    s = wizardReducer(s, { type: "USE_PROFILE", pets: [dogPet()] });
    s = wizardReducer(s, { type: "BACK" });
    expect(s.step).toBe("welcome");
    expect(s.formData.pets).toHaveLength(1);

    // Desde owner → schedule
    s = wizardReducer(s, { type: "USE_PROFILE", pets: [dogPet()] });
    s = wizardReducer(s, { type: "NEXT" }); // schedule → owner
    s = wizardReducer(s, { type: "BACK" });
    expect(s.step).toBe("schedule");

    // Desde review → owner
    s = wizardReducer(s, { type: "NEXT" }); // schedule → owner
    s = wizardReducer(s, { type: "UPDATE_FIELD", field: "date", value: "2026-10-20" });
    s = wizardReducer(s, { type: "NEXT" }); // owner → review (con fecha)
    s = wizardReducer(s, { type: "BACK" });
    expect(s.step).toBe("owner");
  });

  it("BACK del alta de mascota retrocede paso a paso conservando lo escrito", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "ADD_PET_FROM_WELCOME" });
    // Llena el borrador de la nueva mascota
    s.formData.petName = "Rex";
    s.formData.service = "bath";

    s = wizardReducer(s, { type: "NEXT" }); // petType → petInfo
    s = wizardReducer(s, { type: "UPDATE_FIELD", field: "size", value: "small" });
    s = wizardReducer(s, { type: "NEXT" }); // petInfo → size (perro)
    s = wizardReducer(s, { type: "NEXT" }); // size → petAdded

    s = wizardReducer(s, { type: "BACK" }); // petAdded → size, conserva lo escrito
    expect(s.step).toBe("size");
    expect(s.formData.petName).toBe("Rex");
    expect(s.formData.size).toBe("small");

    s = wizardReducer(s, { type: "BACK" }); // size → petInfo
    expect(s.step).toBe("petInfo");
    expect(s.formData.petName).toBe("Rex");

    s = wizardReducer(s, { type: "BACK" }); // petInfo → petType, se descarta el borrador
    expect(s.step).toBe("petType");
    expect(s.formData.petName).toBe("");

    s = wizardReducer(s, { type: "BACK" }); // petType → welcome
    expect(s.step).toBe("welcome");
  });

  it("BACK del alta de gato desde petAdded vuelve a petInfo", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "ADD_PET_FROM_WELCOME" });
    s = wizardReducer(s, { type: "UPDATE_FIELD", field: "petType", value: "cat" });
    s = wizardReducer(s, { type: "NEXT" }); // petType → petInfo
    s = wizardReducer(s, { type: "NEXT" }); // petInfo → petAdded (gato omite tamaño)
    s = wizardReducer(s, { type: "BACK" });
    expect(s.step).toBe("petInfo");
  });

  it("START_FRESH reinicia todo", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "START_FRESH", formData: INITIAL_FORM_DATA });
    expect(s.step).toBe("branch");
    expect(s.mode).toBe("initial");
    expect(s.formData.ownerName).toBe("");
    expect(s.formData.pets).toHaveLength(0);
  });

  it("EDIT_OWNER salta a 'Tus datos' y elija fecha si falta", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "EDIT_OWNER" });
    expect(s.step).toBe("owner");

    // Sin fecha aún: el siguiente paso debe ser schedule (no review sin fecha)
    s = wizardReducer(s, { type: "UPDATE_FIELD", field: "date", value: null });
    expect(nextStep("owner", s.formData)).toBe("schedule");
  });

  it("owner → review cuando la fecha ya existe", () => {
    expect(nextStep("owner", { ...INITIAL_FORM_DATA, date: "2026-11-01" })).toBe("review");
    expect(nextStep("owner", { ...INITIAL_FORM_DATA, date: null })).toBe("schedule");
  });

  it("EDIT_OWNER abre 'Tus datos' en modo edición de datos", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "EDIT_OWNER" });
    expect(s.step).toBe("owner");
    expect(s.mode).toBe("ownerEdit");

    // Confirmar (NEXT) regresa a la bienvenida en modo recurrente
    s = wizardReducer(s, { type: "NEXT" });
    expect(s.step).toBe("welcome");
    expect(s.mode).toBe("quick");
  });

  it("ownerEdit: BACK y CONTINUE también vuelven a la bienvenida", () => {
    let s = createInitialState(() => profile());
    s = wizardReducer(s, { type: "EDIT_OWNER" });

    s = wizardReducer(s, { type: "BACK" });
    expect(s.step).toBe("welcome");
    expect(s.mode).toBe("quick");

    s = wizardReducer(s, { type: "EDIT_OWNER" });
    s = wizardReducer(s, { type: "CONTINUE" });
    expect(s.step).toBe("welcome");
    expect(s.mode).toBe("quick");
  });

  it("el flujo sin perfil arranca en la intro de bienvenida", () => {
    expect(INITIAL_STATE.step).toBe("welcome");
    expect(INITIAL_STATE.mode).toBe("initial");
  });
});
