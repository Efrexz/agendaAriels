import { describe, it, expect } from "vitest";
import {
  wizardReducer,
  nextStep,
  prevStep,
  buildPet,
  INITIAL_STATE,
  INITIAL_FORM_DATA,
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

  it("owner → review", () => {
    expect(nextStep("owner", dogForm())).toBe("review");
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

    it("removes last pet when going back from schedule", () => {
      const pet1 = buildPet(dogForm({ petName: "Rex" }));
      const pet2 = buildPet(dogForm({ petName: "Luna" }));
      const s = state({
        step: "schedule",
        formData: { ...dogForm(), pets: [pet1, pet2] },
      });
      const next = wizardReducer(s, { type: "BACK" });
      expect(next.formData.pets).toHaveLength(1);
      expect(next.formData.pets[0].petName).toBe("Rex");
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
      let s = state({ formData: INITIAL_FORM_DATA });

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
      let s = state({ formData: INITIAL_FORM_DATA });

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
