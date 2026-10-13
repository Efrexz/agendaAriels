import { z } from "zod/v4";
import {
  INITIAL_FORM_DATA,
  type FormData,
  type PetData,
} from "../state/wizardReducer";

const PROFILE_KEY = "va_client_profile_v1";

type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function getStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = "__va_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface ClientProfile {
  savedAt: string;
  owner: ProfileOwner;
  pets: PetData[];
}

export type ProfileOwner = Pick<
  FormData,
  | "branch"
  | "ownerName"
  | "ownerPhone"
  | "ownerAddress"
  | "ownerLat"
  | "ownerLng"
  | "ownerEmail"
  | "hasHistory"
  | "ownerDni"
  | "registeredPhone"
  | "registeredPetName"
  | "petBirthDate"
  | "petSpecies"
  | "petBreed"
  | "petCastrated"
  | "mobilityPhoneDifferent"
  | "mobilityPhone"
>;

export type StoredPet = Omit<PetData, "petType"> & { petType: "dog" | "cat" };

export const profileOwnerSchema = z.object({
  branch: z.enum(["san_martin", "los_olivos", "san_miguel"]).nullable(),
  ownerName: z.string(),
  ownerPhone: z.string(),
  ownerAddress: z.string(),
  ownerLat: z.number().nullable(),
  ownerLng: z.number().nullable(),
  ownerEmail: z.string(),
  hasHistory: z.boolean().nullable(),
  ownerDni: z.string(),
  registeredPhone: z.string(),
  registeredPetName: z.string(),
  petBirthDate: z.string(),
  petSpecies: z.enum(["dog", "cat"]).nullable(),
  petBreed: z.string(),
  petCastrated: z.boolean(),
  mobilityPhoneDifferent: z.boolean(),
  mobilityPhone: z.string(),
});

export const profilePetSchema = z.looseObject({
  petType: z.enum(["dog", "cat"]),
  service: z.enum(["bath", "bath_cut", "bath_deslanado"]),
  extraServices: z.array(z.object({ service: z.string(), variant: z.string().optional() })),
  size: z.enum(["small", "medium", "large", "giant"]).nullable(),
  coat: z.enum(["normal", "knotted"]),
  petNotes: z.string(),
  petName: z.string(),
  corteType: z.enum(["rapado", "rebaje", "tijera"]).nullable(),
  corteSpecs: z.string(),
  corteImage: z.string(),
  bathType: z.enum(["hidratado_premium", "medicado", "tradicional"]).nullable(),
  perfume: z.enum(["fruital", "floral", "fresco"]).nullable(),
});

export const profileSchema = z.looseObject({
  savedAt: z.string(),
  owner: profileOwnerSchema,
  pets: z.array(profilePetSchema),
});

export function extractOwner(formData: FormData): ProfileOwner {
  return {
    branch: formData.branch,
    ownerName: formData.ownerName,
    ownerPhone: formData.ownerPhone,
    ownerAddress: formData.ownerAddress,
    ownerLat: formData.ownerLat,
    ownerLng: formData.ownerLng,
    ownerEmail: formData.ownerEmail,
    hasHistory: formData.hasHistory,
    ownerDni: formData.ownerDni,
    registeredPhone: formData.registeredPhone,
    registeredPetName: formData.registeredPetName,
    petBirthDate: formData.petBirthDate,
    petSpecies: formData.petSpecies,
    petBreed: formData.petBreed,
    petCastrated: formData.petCastrated,
    mobilityPhoneDifferent: formData.mobilityPhoneDifferent,
    mobilityPhone: formData.mobilityPhone,
  };
}

export function createProfileFromFormData(formData: FormData): ClientProfile {
  return { savedAt: new Date().toISOString(), owner: extractOwner(formData), pets: formData.pets };
}

export function createPrefilledFormData(profile: ClientProfile): FormData {
  return { ...INITIAL_FORM_DATA, ...profile.owner, pets: profile.pets };
}

/** Escribe el perfil tal cual (sin mezclar). Usada por la semilla demo. */
export function saveClientProfile(formData: FormData, storage: Storage | null = getStorage()): void {
  saveProfile(createProfileFromFormData(formData), storage);
}

function saveProfile(profile: ClientProfile, storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota o error de storage: se ignora */
  }
}

/**
 * Guarda el perfil con la lista de mascotas que el cliente decidió en pantalla
 * (p. ej. tras eliminar una mascota guardada desde la bienvenida), manteniendo
 * los datos del dueño del formData.
 */
export function overwriteClientProfile(
  formData: FormData,
  pets: PetData[],
  storage: Storage | null = getStorage(),
): void {
  saveProfile({ savedAt: new Date().toISOString(), owner: extractOwner(formData), pets }, storage);
}

/** Límite para evitar crecimiento sin control del perfil en localStorage. */
export const MAX_SAVED_PETS = 8;

function petKey(pet: Pick<PetData, "petType" | "petName">): string {
  return `${pet.petType}:${pet.petName.trim().toLowerCase()}`;
}

/**
 * Guarda el perfil mezclando: las mascotas de ESTA reserva (las vigentes),
 * más las mascotas guardadas anteriormente que no van esta vez (no se pierden).
 * Si una mascota se reserva de nuevo, la nueva información reemplaza a la previa.
 */
export function saveClientProfileMerged(
  formData: FormData,
  storage: Storage | null = getStorage(),
): ClientProfile {
  const existing = loadClientProfile(storage)?.pets ?? [];
  const bookingKeys = new Set(formData.pets.map(petKey));
  const carried = existing.filter((pet) => !bookingKeys.has(petKey(pet)));
  const merged = [...formData.pets, ...carried].slice(0, MAX_SAVED_PETS);
  const profile: ClientProfile = {
    savedAt: new Date().toISOString(),
    owner: extractOwner(formData),
    pets: merged,
  };
  saveProfile(profile, storage);
  return profile;
}

export function loadClientProfile(storage: Storage | null = getStorage()): ClientProfile | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = profileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      storage.removeItem(PROFILE_KEY);
      return null;
    }
    return parsed.data as ClientProfile;
  } catch {
    try {
      storage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clearClientProfile(storage: Storage | null = getStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
