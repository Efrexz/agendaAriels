import { z } from "zod/v4";
import type { ZodIssue } from "zod/v4";

const PET_DRAFT_ERRORS: Record<string, string> = {
  petName: "El nombre de la mascota necesita al menos 3 letras",
  service: "Elige un servicio principal (Baño o Baño y Corte)",
  bathType: "Elige un tipo de baño",
  corteType: "Elige un tipo de corte",
};

function formatIssues(
  issues: readonly ZodIssue[],
  labelMap: Record<string, string>,
): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];

  for (const issue of issues) {
    const path = issue.path.join(".");
    const msg = labelMap[path] ?? issue.message;
    if (!seen.has(msg)) {
      seen.add(msg);
      errors.push(msg);
    }
  }

  return errors;
}

export const petDraftSchema = z
  .object({
    petName: z.string().min(3),
    service: z.enum(["bath", "bath_cut", "bath_deslanado"]),
    bathType: z.enum(["hidratado_premium", "medicado", "tradicional"]),
    corteType: z.enum(["rapado", "rebaje", "tijera"]).nullable(),
  })
  .refine(
    (data) => data.service !== "bath_cut" || data.corteType !== null,
    { params: { path: ["corteType"] } },
  );

export function validatePetDraft(data: {
  petName: string;
  service: string | null;
  bathType: string | null;
  corteType: string | null;
}): string[] {
  const result = petDraftSchema.safeParse(data);
  if (result.success) return [];
  return formatIssues(result.error.issues, PET_DRAFT_ERRORS);
}

export function validateOwnerInfo(data: {
  ownerDni: string;
  ownerName: string;
  ownerAddress: string;
  ownerPhone: string;
  registeredPhone: string;
  registeredPetName: string;
  petBirthDate: string;
  petSpecies: string | null;
  petBreed: string;
  hasHistory: boolean | null;
  mobilityPhoneDifferent: boolean;
  mobilityPhone: string;
  legalAgeConfirmed: boolean;
  ownerEmail: string;
}): boolean {
  if (data.hasHistory === null) return false;

  const baseFields = {
    ownerDni: data.ownerDni,
    ownerName: data.ownerName,
  };

  const baseSchema = z.object({
    ownerDni: z.string().min(1),
    ownerName: z.string().min(1),
  });

  if (data.hasHistory) {
    const schema = baseSchema.extend({
      registeredPhone: z.string().min(1),
    });
    const result = schema.safeParse({ ...baseFields, registeredPhone: data.registeredPhone });
    if (!result.success) return false;
  } else {
    if (!data.legalAgeConfirmed) return false;

    const schema = baseSchema.extend({
      ownerAddress: z.string().min(1),
      ownerPhone: z.string().min(1),
      registeredPetName: z.string().min(1),
      petBirthDate: z.string().min(1),
      petSpecies: z.enum(["dog", "cat"]),
      petBreed: z.string().min(1),
    });
    const result = schema.safeParse({
      ...baseFields,
      ownerAddress: data.ownerAddress,
      ownerPhone: data.ownerPhone,
      registeredPetName: data.registeredPetName,
      petBirthDate: data.petBirthDate,
      petSpecies: data.petSpecies,
      petBreed: data.petBreed,
    });
    if (!result.success) return false;
  }

  if (data.mobilityPhoneDifferent && data.mobilityPhone.trim() === "") {
    return false;
  }

  if (data.ownerEmail.trim() !== "" && !z.string().email().safeParse(data.ownerEmail).success) {
    return false;
  }

  return true;
}
