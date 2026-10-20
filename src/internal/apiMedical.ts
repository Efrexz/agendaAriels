import { getSupabaseClient } from "./supabaseClient";

// Cliente de /api/medical/* para el panel (con JWT del staff).

export interface MedAppt {
  id: string;
  appointmentCode: string;
  branch: string;
  serviceType: "general" | "rayos" | "eco" | "especializada";
  specialtyId: string | null;
  specialtyName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  apptDate: string | null;
  startMinute: number | null;
  durationMinutes: number;
  needsOrder: boolean;
  hasOrder: boolean | null;
  status: string;
  petName: string;
  petType: string;
  petNotes: string;
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  paymentNotes: string;
  createdByClient: boolean;
  createdBy: string;
  createdAt: string;
  timeline?: Array<{ status: string; createdBy: string; createdAt: string }>;
}

export interface MedDoctorPanel {
  id: string;
  fullName: string;
  branch: string;
  kind: "general" | "especialista";
  specialtyName: string | null;
  active: boolean;
}

export interface MedSpecialtyPanel {
  id: string;
  name: string;
  cost: number;
  branches: string[];
  active: boolean;
}

export interface ScheduleWithDoctor {
  id: string;
  doctorId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
  doctorName: string;
  branch: string;
  kind: string;
}

export type MedSlot = { startMinute: number; endMinute: number; label: string };

async function authedFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const client = getSupabaseClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { ok?: boolean; error?: string };
  if (!res.ok || body.ok === false) {
    if (res.status === 401) throw new Error("Sesión expirada. Vuelve a iniciar sesión.");
    throw new Error(body.error ?? `Error del servidor (${res.status})`);
  }
  return body;
}

export async function fetchMedDay(date: string, branch: string | "all"): Promise<{ appointments: MedAppt[] }> {
  const b = branch === "all" ? "" : `&branch=${branch}`;
  return authedFetch(`/api/medical/day?date=${date}${b}`);
}

export async function fetchMedPending(branch: string | "all"): Promise<{ appointments: MedAppt[] }> {
  const b = branch === "all" ? "" : `&branch=${branch}`;
  return authedFetch(`/api/medical/day${b}`); // sin date → "por asignar"
}

export async function searchMedAppts(q: string): Promise<{ results: MedAppt[] }> {
  return authedFetch(`/api/medical/search?q=${encodeURIComponent(q)}`);
}

export async function patchMedStatus(
  apptId: string,
  status: string,
): Promise<{ status: string; notified: boolean }> {
  return authedFetch("/api/medical/status", {
    method: "PATCH",
    body: JSON.stringify({ id: apptId, status }),
  });
}

export async function assignMedAppt(input: {
  id: string;
  doctorId: string;
  apptDate: string;
  startMinute: number;
  paymentNotes?: string;
}): Promise<{ status: string }> {
  return authedFetch("/api/medical/assign", { method: "POST", body: JSON.stringify(input) });
}

export async function fetchSchedules(): Promise<{ schedules: ScheduleWithDoctor[] }> {
  return authedFetch("/api/medical/schedules");
}

export async function createSchedule(input: {
  doctorId: string;
  weekday: number;
  startMinute: number;
  endMinute: number;
}): Promise<{ ok: boolean }> {
  return authedFetch("/api/medical/schedules", { method: "POST", body: JSON.stringify(input) });
}

export async function deleteSchedule(id: string): Promise<{ ok: boolean }> {
  return authedFetch(`/api/medical/schedules?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function fetchMedConfig(): Promise<{ config: Record<string, string> }> {
  return authedFetch("/api/medical/config");
}

export async function putMedConfig(key: string, value: string): Promise<{ ok: boolean }> {
  return authedFetch("/api/medical/config", { method: "PUT", body: JSON.stringify({ key, value }) });
}

export async function fetchCatalog(): Promise<{ doctors: MedDoctorPanel[]; specialties: MedSpecialtyPanel[] }> {
  return authedFetch("/api/medical/catalog");
}

export async function createDoctor(input: {
  fullName: string;
  branch: string;
  doctorKind: "general" | "especialista";
  specialtyId?: string | null;
}): Promise<{ ok: boolean }> {
  return authedFetch("/api/medical/catalog", { method: "POST", body: JSON.stringify({ kind: "doctor", ...input }) });
}

export async function updateCatalog(kind: "doctor" | "specialty", patch: Record<string, unknown>): Promise<{ ok: boolean }> {
  return authedFetch("/api/medical/catalog", {
    method: "PATCH",
    body: JSON.stringify({ kind, ...patch }),
  });
}

export async function createSpecialty(input: {
  name: string;
  cost: number;
  branches: string[];
}): Promise<{ ok: boolean }> {
  return authedFetch("/api/medical/catalog", {
    method: "POST",
    body: JSON.stringify({ kind: "specialty", ...input }),
  });
}
