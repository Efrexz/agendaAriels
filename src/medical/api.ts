// Cliente API del wizard de citas médicas (público, sin auth).
// Endpoints: /api/medical/{doctors,specialties,availability,create}

export interface MedDoctor {
  id: string;
  name: string;
  kind: "general" | "especialista";
  specialty: string | null;
}

export interface MedSpecialty {
  id: string;
  name: string;
  cost: number;
  branches: string[];
}

export interface MedSlot {
  startMinute: number;
  endMinute: number;
  label: string;
}

export interface CreateApptPayload {
  branch: MedBranch;
  serviceType: "general" | "rayos" | "eco" | "especializada";
  specialtyId?: string | null;
  doctorId?: string | null;
  date?: string | null;
  startMinute?: number | null;
  hasOrder?: boolean | null;
  petName: string;
  petType: string;
  petNotes: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
}

export type MedBranch = "san_martin" | "los_olivos" | "san_miguel";

export const MED_BRANCHES: Array<{ value: MedBranch; label: string; short: string; image: string }> = [
  { value: "san_martin", label: "Sede San Martín de Porres", short: "San Martín", image: "/images/sedes/sanMartin.webp" },
  { value: "los_olivos", label: "Sede Los Olivos", short: "Los Olivos", image: "/images/sedes/olivos.webp" },
  { value: "san_miguel", label: "Sede San Miguel", short: "San Miguel", image: "/images/sedes/sanMiguel.webp" },
];

export const MED_BRANCH_PHONES: Record<MedBranch, string> = {
  san_martin: "51986985047",
  los_olivos: "51932719342",
  san_miguel: "51954599221",
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  // Sin functions (vite dev puro) el fallback de Vite responde HTML: no es JSON
  // → mensaje amigable en vez de "Cannot read properties of undefined".
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("application/json")) {
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && body?.ok !== false) throw new Error("No se pudo conectar con la veterinaria");
    throw new Error(body?.error ?? `Error del servidor (${res.status})`);
  }
  const body = (await res.json()) as T & { ok?: boolean; error?: string };
  if (body.ok === false) throw new Error(body.error ?? `Error del servidor`);
  return body;
}

export async function fetchDoctors(branch: MedBranch, kind?: "general" | "especialista"): Promise<MedDoctor[]> {
  const qs = new URLSearchParams({ sede: branch });
  if (kind) qs.set("kind", kind);
  const { doctors } = await jsonFetch<{ doctors: MedDoctor[] }>(`/api/medical/doctors?${qs}`);
  return doctors;
}

export async function fetchSpecialties(branch: MedBranch): Promise<MedSpecialty[]> {
  const { specialties } = await jsonFetch<{ specialties: MedSpecialty[] }>(
    `/api/medical/specialties?sede=${branch}`,
  );
  return specialties;
}

export async function fetchSlots(doctorId: string, date: string): Promise<MedSlot[]> {
  const { slots } = await jsonFetch<{ slots: MedSlot[] }>(
    `/api/medical/availability?doctor=${encodeURIComponent(doctorId)}&date=${date}`,
  );
  return slots;
}

export async function createAppointment(
  payload: CreateApptPayload,
): Promise<{ appointmentCode: string }> {
  return jsonFetch<{ appointmentCode: string }>("/api/medical/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
