import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { FormData } from "../components/BookingWizard";
import { BRANCH_BY_VALUE } from "../data/branches";
import {
  PET_TYPE_LABELS,
  SERVICE_LABELS,
  SIZE_LABELS,
  TIME_LABELS,
  formatExtraLabel,
  CORTE_LABELS,
  BATH_LABELS,
  PERFUME_LABELS,
} from "../data/labels";

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
}

function labelOr(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "-";
  return map[key] ?? key;
}

export function buildBookingPayload(formData: FormData) {
  const branch = formData.branch ? BRANCH_BY_VALUE[formData.branch] : null;

  return {
    submittedAt: new Date().toISOString(),
    branch: formData.branch,
    branchLabel: branch?.label ?? "-",
    branchPhone: branch?.phone ?? "-",
    pets: formData.pets.map((pet) => ({
      name: pet.petName || "-",
      type: labelOr(PET_TYPE_LABELS, pet.petType),
      service: labelOr(SERVICE_LABELS, pet.service),
      size: labelOr(SIZE_LABELS, pet.size),
      bathType: labelOr(BATH_LABELS, pet.bathType),
      corteType: pet.service === "bath_cut" ? labelOr(CORTE_LABELS, pet.corteType) : "-",
      corteSpecs: pet.corteSpecs || "-",
      extras: (pet.extraServices || []).map(formatExtraLabel),
      perfume: labelOr(PERFUME_LABELS, pet.perfume),
      notes: pet.petNotes || "-",
    })),
    date: formData.date ?? null,
    dateLabel: formData.date ? formatDate(formData.date) : "-",
    timeRangeLabel: labelOr(TIME_LABELS, formData.timeRange),
    ownerName: formData.ownerName || "-",
    ownerDni: formData.ownerDni || "-",
    ownerPhone: formData.ownerPhone || "-",
    ownerAddress: formData.ownerAddress || "-",
    hasHistory: formData.hasHistory,
    registeredPetName: formData.registeredPetName || "-",
    registeredPhone: formData.registeredPhone || "-",
    petBirthDate: formData.petBirthDate || "-",
    petSpecies: labelOr(PET_TYPE_LABELS, formData.petSpecies),
    petBreed: formData.petBreed || "-",
    petCastrated: formData.petCastrated,
    mobilityPhoneDifferent: formData.mobilityPhoneDifferent,
    mobilityPhone: formData.mobilityPhone || "-",
  };
}

export async function submitBooking(formData: FormData): Promise<SubmitResult> {
  const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, error: "URL del webhook no configurada" };
  }

  const payload = buildBookingPayload(formData);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { ok: false, error: `Error del servidor (${response.status})` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de conexión" };
  }
}