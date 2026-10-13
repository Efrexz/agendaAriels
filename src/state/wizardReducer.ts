export interface ExtraService {
  service: string;
  variant?: string;
}

export interface PetData {
  petType: "dog" | "cat";
  service: "bath" | "bath_cut" | "bath_deslanado";
  extraServices: ExtraService[];
  size: "small" | "medium" | "large" | "giant" | null;
  coat: "normal" | "knotted";
  petNotes: string;
  petName: string;
  corteType: "rapado" | "rebaje" | "tijera" | null;
  corteSpecs: string;
  corteImage: string;
  bathType: "hidratado_premium" | "medicado" | "tradicional" | null;
  perfume: "fruital" | "floral" | "fresco" | null;
}

export interface FormData {
  branch: "san_martin" | "los_olivos" | "san_miguel" | null;
  petType: "dog" | "cat" | null;
  service: "bath" | "bath_cut" | "bath_deslanado" | null;
  extraServices: ExtraService[];
  size: "small" | "medium" | "large" | "giant" | null;
  coat: "normal" | "knotted";
  petNotes: string;
  petName: string;
  corteType: "rapado" | "rebaje" | "tijera" | null;
  corteSpecs: string;
  corteImage: string;
  bathType: "hidratado_premium" | "medicado" | "tradicional" | null;
  perfume: "fruital" | "floral" | "fresco" | null;
  pets: PetData[];
  date: string | null;
  timeRange: "9-11" | "11-14" | null;
  ownerName: string;
  ownerPhone: string;
  ownerAddress: string;
  ownerLat: number | null;
  ownerLng: number | null;
  hasHistory: boolean | null;
  ownerDni: string;
  registeredPetName: string;
  registeredPhone: string;
  petBirthDate: string;
  petSpecies: "dog" | "cat" | null;
  petBreed: string;
  petCastrated: boolean;
  mobilityPhoneDifferent: boolean;
  mobilityPhone: string;
  legalAgeConfirmed: boolean;
  ownerEmail: string;
}

export const INITIAL_PET_FIELDS = {
  petType: null as "dog" | "cat" | null,
  service: null as "bath" | "bath_cut" | "bath_deslanado" | null,
  extraServices: [] as ExtraService[],
  size: null as "small" | "medium" | "large" | "giant" | null,
  coat: "normal" as "normal" | "knotted",
  petNotes: "",
  petName: "",
  corteType: null as "rapado" | "rebaje" | "tijera" | null,
  corteSpecs: "",
  corteImage: "",
  bathType: null as "hidratado_premium" | "medicado" | "tradicional" | null,
  perfume: null as "fruital" | "floral" | "fresco" | null,
};

export const INITIAL_FORM_DATA: FormData = {
  ...INITIAL_PET_FIELDS,
  branch: null,
  corteType: null,
  corteSpecs: "",
  corteImage: "",
  bathType: null,
  perfume: null,
  pets: [],
  date: null,
  timeRange: null,
  ownerName: "",
  ownerPhone: "",
  ownerAddress: "",
  ownerLat: null,
  ownerLng: null,
  hasHistory: null,
  ownerDni: "",
  registeredPetName: "",
  registeredPhone: "",
  petBirthDate: "",
  petSpecies: null,
  petBreed: "",
  petCastrated: false,
  mobilityPhoneDifferent: false,
  mobilityPhone: "",
  legalAgeConfirmed: false,
  ownerEmail: "",
};

export type StepId = "welcome" | "branch" | "petType" | "petInfo" | "size" | "petAdded" | "schedule" | "owner" | "review";

export type Mode = "initial" | "addingFromSummary" | "editing" | "quick" | "ownerEdit";

export function nextStep(step: StepId, formData: FormData): StepId {
  switch (step) {
    case "welcome": return "schedule";
    case "branch": return "petType";
    case "petType": return "petInfo";
    case "petInfo": return formData.petType === "cat" ? "petAdded" : "size";
    case "size": return "petAdded";
    case "petAdded": return "schedule";
    case "schedule": return "owner";
    // Defensa: si se salta directo a "Tus datos" (editar datos desde la
    // bienvenida) sin haber elegido fecha, el siguiente paso es elegir fecha.
    case "owner": return formData.date ? "review" : "schedule";
    case "review": return "review";
  }
}

export function prevStep(step: StepId, formData: FormData): StepId {
  switch (step) {
    case "welcome": return "welcome";
    case "branch": return "branch";
    case "petType": return "branch";
    case "petInfo": return "petType";
    case "size": return "petInfo";
    case "petAdded": return formData.petType === "cat" ? "petInfo" : "size";
    case "schedule": return formData.petType === "cat" ? "petInfo" : "size";
    case "owner": return "schedule";
    case "review": return "owner";
  }
}

export function buildPet(formData: FormData): PetData {
  const isCat = formData.petType === "cat";

  return {
    petType: formData.petType!,
    service: formData.service!,
    extraServices: formData.extraServices,
    size: isCat ? null : formData.size,
    coat: formData.coat,
    petNotes: formData.petNotes,
    petName: formData.petName,
    corteType: formData.corteType,
    corteSpecs: formData.corteSpecs,
    corteImage: formData.corteImage,
    bathType: formData.bathType,
    perfume: formData.perfume,
  };
}

export type WizardAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "CONTINUE" }
  | { type: "ADD_ANOTHER" }
  | { type: "ADD_FROM_CONFIRMATION" }
  | { type: "EDIT_PET"; index: number }
  | { type: "REMOVE_PET"; index: number }
  | { type: "UPDATE_FIELD"; field: keyof FormData; value: FormData[keyof FormData] }
  | { type: "USE_PROFILE"; pets: FormData["pets"] }
  | { type: "DELETE_SAVED_PET"; index: number }
  | { type: "ADD_PET_FROM_WELCOME" }
  | { type: "START_BOOKING" }
  | { type: "EDIT_OWNER" }
  | { type: "START_FRESH"; formData: FormData };

export type WizardState = {
  step: StepId;
  mode: Mode;
  editingIndex: number | null;
  formData: FormData;
  /** Todas las mascotas guardadas del perfil (independiente de lo que va en ESTA reserva). */
  profilePets: FormData["pets"];
};

export const INITIAL_STATE: WizardState = {
  step: "welcome",
  mode: "initial",
  editingIndex: null,
  formData: INITIAL_FORM_DATA,
  profilePets: [],
};

/**
 * Estado inicial del wizard: siempre arranca en la pantalla de bienvenida.
 * Si el navegador guarda un perfil de cliente válido con mascotas, la muestra
 * en variante "cliente recurrente" (modo quick, datos prellenados); si no,
 * en variante intro ("solo la primera vez pediremos tus datos").
 */
export function createInitialState(loadProfile: () => WizardProfileLike | null): WizardState {
  const profile = loadProfile();
  if (profile && profile.pets.length > 0) {
    return {
      step: "welcome",
      mode: "quick",
      editingIndex: null,
      formData: { ...INITIAL_FORM_DATA, ...profile.owner, pets: profile.pets },
      profilePets: [...profile.pets],
    };
  }
  return INITIAL_STATE;
}

/** Subconjunto del perfil guardado que usa createInitialState. */
export interface WizardProfileLike {
  owner: Partial<FormData>;
  pets: FormData["pets"];
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "UPDATE_FIELD":
      return { ...state, formData: { ...state.formData, [action.field]: action.value } };

    case "NEXT": {
      // Modo "actualizar mis datos" (estamos desde la bienvenida sin agendar):
      // confirmar regresa a la bienvenida con los datos ya en el estado.
      if (state.mode === "ownerEdit" && state.step === "owner") {
        return { ...state, step: "welcome" as StepId, mode: "quick" as Mode };
      }
      return { ...state, step: nextStep(state.step, state.formData) };
    }

    case "BACK": {
      // Modo edición de datos sin agendar: atrás también manda a la bienvenida
      // (sin considerar lo tocado: solo se persiste al confirmar "Actualizar datos").
      if (state.mode === "ownerEdit") {
        return { ...state, step: "welcome" as StepId, mode: "quick" as Mode };
      }

      // Flujo recurrente (modo quick): mapa explícito de retroceso.
      if (state.mode === "quick") {
        // Alta de mascota desde la bienvenida: se retrocede PASO A PASO
        // conservando lo ya escrito; solo al salir del alta (hacia la
        // bienvenida) se descarta el borrador.
        if (
          state.step === "petAdded" ||
          state.step === "size" ||
          state.step === "petInfo" ||
          state.step === "petType"
        ) {
          const backTarget = prevStep(state.step, state.formData);
          const leavingAddFlow = backTarget !== "petInfo" && backTarget !== "size" && backTarget !== "petType";
          const resetPetFields = leavingAddFlow || backTarget === "petType";
          return {
            ...state,
            step: leavingAddFlow ? ("welcome" as StepId) : (backTarget as StepId),
            formData: resetPetFields
              ? { ...state.formData, ...INITIAL_PET_FIELDS }
              : state.formData,
          };
        }

        const QUICK_BACK_TARGET: Partial<Record<StepId, StepId>> = {
          schedule: "welcome",
          owner: "schedule",
          review: "owner",
        };
        const target = QUICK_BACK_TARGET[state.step];
        if (target) {
          return { ...state, step: target };
        }
      }

      if (state.mode !== "initial") {
        return {
          ...state,
          step: "review" as StepId,
          mode: "initial" as Mode,
          editingIndex: null,
          formData: { ...state.formData, ...INITIAL_PET_FIELDS },
        };
      }

      let formData = { ...state.formData };
      const step = prevStep(state.step, state.formData);

      if (state.step === "schedule") {
        const lastPet = formData.pets[formData.pets.length - 1];
        if (lastPet) {
          formData = {
            ...formData,
            petType: lastPet.petType,
            service: lastPet.service,
            extraServices: lastPet.extraServices,
            size: lastPet.size,
            coat: lastPet.coat,
            petNotes: lastPet.petNotes,
            petName: lastPet.petName,
            corteType: lastPet.corteType,
            corteSpecs: lastPet.corteSpecs,
            corteImage: lastPet.corteImage,
            bathType: lastPet.bathType,
            perfume: lastPet.perfume,
          };
        }
        formData.pets = formData.pets.slice(0, -1);
      }

      if (step === "branch" || step === "petType") {
        formData = { ...formData, ...INITIAL_PET_FIELDS };
      }

      return { ...state, step, formData };
    }

    case "CONTINUE": {
      // Defensa: en modo edición de datos el objetivo siempre es bienvenida.
      if (state.mode === "ownerEdit") {
        return { ...state, step: "welcome" as StepId, mode: "quick" as Mode };
      }

      const pet = buildPet(state.formData);
      const pets = state.editingIndex !== null
        ? state.formData.pets.map((p, i) => (i === state.editingIndex ? pet : p))
        : [...state.formData.pets, pet];

      const newFormData = { ...state.formData, pets, ...INITIAL_PET_FIELDS };

      if (state.mode === "editing" || state.mode === "addingFromSummary") {
        return {
          ...state,
          step: "review" as StepId,
          mode: "initial" as Mode,
          editingIndex: null,
          formData: newFormData,
        };
      }

      // modo quick (se llegó por la bienvenida o se está agregando una mascota
      // desde ahí): tras guardar la mascota se elige fecha y horario; la nueva
      // mascota también queda en el listado guardado (profilePets).
      return {
        ...state,
        step: "schedule" as StepId,
        mode: "initial" as Mode,
        editingIndex: null,
        formData: newFormData,
        profilePets: [...state.profilePets, pet],
      };
    }

    case "ADD_ANOTHER": {
      const pet = buildPet(state.formData);
      const pets = state.editingIndex !== null
        ? state.formData.pets.map((p, i) => (i === state.editingIndex ? pet : p))
        : [...state.formData.pets, pet];

      return {
        ...state,
        step: "petType" as StepId,
        editingIndex: null,
        formData: { ...state.formData, pets, ...INITIAL_PET_FIELDS },
      };
    }

    case "ADD_FROM_CONFIRMATION":
      return {
        ...state,
        step: "petType" as StepId,
        mode: "addingFromSummary" as Mode,
        editingIndex: null,
        formData: { ...state.formData, ...INITIAL_PET_FIELDS },
      };

    case "EDIT_PET": {
      const pet = state.formData.pets[action.index];
      if (!pet) return state;

      return {
        ...state,
        step: "petInfo" as StepId,
        mode: "editing" as Mode,
        editingIndex: action.index,
        formData: {
          ...state.formData,
          ...INITIAL_PET_FIELDS,
          petType: pet.petType,
          service: pet.service,
          extraServices: pet.extraServices,
          size: pet.size,
          coat: pet.coat,
          petNotes: pet.petNotes,
          petName: pet.petName,
          corteType: pet.corteType,
          corteSpecs: pet.corteSpecs,
          corteImage: pet.corteImage,
          bathType: pet.bathType,
          perfume: pet.perfume,
        },
      };
    }

    case "REMOVE_PET":
      return {
        ...state,
        formData: {
          ...state.formData,
          pets: state.formData.pets.filter((_, i) => i !== action.index),
        },
        editingIndex: state.editingIndex === action.index ? null : state.editingIndex,
      };

    case "USE_PROFILE": {
      return {
        ...state,
        step: action.pets.length > 0 ? ("schedule" as StepId) : ("welcome" as StepId),
        formData: { ...state.formData, pets: action.pets },
      };
    }

    case "DELETE_SAVED_PET": {
      const inProfile = state.profilePets.filter((_, i) => i !== action.index);
      const removed = state.profilePets[action.index];
      const removedKey = removed ? `${removed.petType}:${removed.petName.trim().toLowerCase()}` : null;
      return {
        ...state,
        profilePets: inProfile,
        formData: {
          ...state.formData,
          pets: state.formData.pets.filter(
            (pet) => `${pet.petType}:${pet.petName.trim().toLowerCase()}` !== removedKey,
          ),
        },
      };
    }

    case "START_BOOKING":
      return { ...state, step: "branch" as StepId };

    case "EDIT_OWNER":
      // Salto directo al paso "Tus datos" (prellenado) desde la bienvenida,
      // en modo edición: confirmar actualiza y regresa a la bienvenida.
      return { ...state, step: "owner" as StepId, mode: "ownerEdit" as Mode };

    case "ADD_PET_FROM_WELCOME":
      return {
        ...state,
        step: "petType" as StepId,
        mode: "quick" as Mode,
        editingIndex: null,
        formData: { ...state.formData, ...INITIAL_PET_FIELDS },
      };

    case "START_FRESH":
      return {
        ...state,
        step: "branch" as StepId,
        mode: "initial" as Mode,
        editingIndex: null,
        formData: action.formData,
        profilePets: [],
      };

    default:
      return state;
  }
}
