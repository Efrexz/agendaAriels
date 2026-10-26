// Perfil del dueño para el WIZARD MÉDICO — mismo espíritu que el grooming
// (todo vive en el NAVEGADOR del cliente, nunca viaja a un servidor; la
// historia clínica real solo vive en VetPraxis/Sede). Guardado SOLO tras una
// cita registrada con éxito; el cliente puede olvidarlo con un botón.
import { z } from "zod/v4";

const PROFILE_KEY = "vcm_client_profile_v1";

type Storage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function getStorage(): Storage | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = "__vcm_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export interface MedOwnerProfile {
  savedAt: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
}

const profileSchema = z.object({
  savedAt: z.string(),
  ownerName: z.string(),
  ownerPhone: z.string(),
  ownerEmail: z.string(),
});

/** Solo se recuerdan campos NUM no-vacíos (mascota/examen van visita a visita). */
export function saveMedProfile(input: {
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
}, storage: Storage | null = getStorage()): void {
  if (!storage) return;
  const clean = {
    ownerName: input.ownerName.trim(),
    ownerPhone: input.ownerPhone.trim(),
    ownerEmail: input.ownerEmail.trim(),
  };
  if (!clean.ownerName && !clean.ownerPhone) return;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), ...clean }));
  } catch {
    /* quota: se ignora */
  }
}

export function loadMedProfile(storage: Storage | null = getStorage()): MedOwnerProfile | null {
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
    return parsed.data;
  } catch {
    try {
      storage.removeItem(PROFILE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clearMedProfile(storage: Storage | null = getStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
